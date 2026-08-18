import { CommandContext } from '../types';
import initSqlJs from 'sql.js';

let SQLPromise: Promise<any> | null = null;

function getSQL() {
  if (!SQLPromise) {
    SQLPromise = initSqlJs({
      locateFile: (file: string) => {
        if (typeof window !== 'undefined') {
          return `/wasm/${file}`;
        }
        try {
          const path = require('path');
          return path.join(process.cwd(), 'node_modules/sql.js/dist', file);
        } catch {
          return file;
        }
      },
    });
  }
  return SQLPromise;
}

export const sqliteCmd = async (ctx: CommandContext): Promise<number> => {
  const args = ctx.args;

  try {
    ctx.stdout('\x1b[90m[Initializing SQLite3 engine...]\x1b[0m\r\n');
    const SQL = await getSQL();

    let dbFile = 'app.db';
    let sqlQuery = '';

    if (args.length === 1 && !args[0].startsWith('-')) {
      if (args[0].endsWith('.db') || args[0].endsWith('.sqlite')) {
        dbFile = args[0];
      } else {
        sqlQuery = args[0];
      }
    } else if (args.length >= 2) {
      dbFile = args[0];
      sqlQuery = args.slice(1).join(' ');
    }

    if (ctx.stdin) {
      sqlQuery = ctx.stdin;
    }

    // Load existing database file from OPFS if present
    let dbData: Uint8Array | undefined;
    if (await ctx.vfs.exists(dbFile)) {
      dbData = await ctx.vfs.readFile(dbFile);
    }

    const db = dbData ? new SQL.Database(dbData) : new SQL.Database();

    if (!sqlQuery) {
      // Demo / Interactive Banner
      ctx.stdout(`
\x1b[1;36mSQLite version 3.45 (WASM engine on wasmvm)\x1b[0m
Database: \x1b[32m${dbFile}\x1b[0m (saved to OPFS)

\x1b[1;33mExecuting Sample SQL Table Creation & Query:\x1b[0m
`);
      db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, role TEXT);');
      db.run('INSERT INTO users (name, role) VALUES ("Alice", "Developer"), ("Bob", "Architect");');
      sqlQuery = 'SELECT * FROM users;';
    }

    try {
      const results = db.exec(sqlQuery);

      if (results.length === 0) {
        ctx.stdout('\x1b[32mQuery executed successfully (0 rows returned).\x1b[0m\r\n');
      } else {
        for (const res of results) {
          const cols = res.columns;
          const rows = res.values;

          // Format pretty table
          const header = cols.map((c: string) => `\x1b[1;34m${c.padEnd(12, ' ')}\x1b[0m`).join(' | ');
          const sep = cols.map(() => '------------').join('-+-');

          ctx.stdout(header + '\r\n');
          ctx.stdout(sep + '\r\n');

          for (const row of rows) {
            const rowStr = row.map((val: any) => String(val ?? 'NULL').padEnd(12, ' ')).join(' | ');
            ctx.stdout(rowStr + '\r\n');
          }
          ctx.stdout(`\r\n\x1b[32m(${rows.length} row${rows.length > 1 ? 's' : ''})\x1b[0m\r\n`);
        }
      }

      // Save database back to OPFS
      const exported = db.export();
      await ctx.vfs.writeFile(dbFile, exported);
      ctx.stdout(`\x1b[90m[Database saved to '${dbFile}' in OPFS]\x1b[0m\r\n`);
      return 0;
    } catch (e: any) {
      ctx.stderr(`SQLite Error: ${e.message}\r\n`);
      return 1;
    } finally {
      db.close();
    }
  } catch (e: any) {
    ctx.stderr(`Failed to run SQLite3: ${e.message}\r\n`);
    return 1;
  }
};
