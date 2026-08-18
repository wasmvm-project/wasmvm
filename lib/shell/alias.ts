export class AliasManager {
  private static instance: AliasManager | null = null;
  private aliases: Map<string, string> = new Map();

  private constructor() {
    this.initDefaultAliases();
  }

  public static getInstance(): AliasManager {
    if (!AliasManager.instance) {
      AliasManager.instance = new AliasManager();
    }
    return AliasManager.instance;
  }

  private initDefaultAliases(): void {
    this.aliases.set('ll', 'ls -la');
    this.aliases.set('la', 'ls -A');
    this.aliases.set('l', 'ls -lh');
    this.aliases.set('cls', 'clear');
    this.aliases.set('md', 'mkdir -p');
    this.aliases.set('rd', 'rm -rf');
  }

  public set(name: string, command: string): void {
    this.aliases.set(name, command);
  }

  public get(name: string): string | undefined {
    return this.aliases.get(name);
  }

  public remove(name: string): boolean {
    return this.aliases.delete(name);
  }

  public getAll(): Map<string, string> {
    return new Map(this.aliases);
  }

  /**
   * コマンドの先頭がエイリアスであれば展開
   */
  public expand(cmdName: string): string[] | null {
    const aliased = this.aliases.get(cmdName);
    if (!aliased) return null;
    return aliased.split(/\s+/).filter(Boolean);
  }
}
