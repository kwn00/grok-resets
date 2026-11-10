export function unreachable(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
