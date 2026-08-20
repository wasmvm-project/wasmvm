export const spawn = () => {
  throw new Error("child_process.spawn is not supported in WASMVM");
};
export const spawnSync = () => {
  throw new Error("child_process.spawnSync is not supported in WASMVM");
};
export const exec = () => {
  throw new Error("child_process.exec is not supported in WASMVM");
};
export const execSync = () => {
  throw new Error("child_process.execSync is not supported in WASMVM");
};
export default { spawn, spawnSync, exec, execSync };
