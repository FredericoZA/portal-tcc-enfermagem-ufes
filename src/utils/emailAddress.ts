/** Same address syntax used by forms and workflow recipients, in linear time. */
export function isEmailAddress(value: string): boolean {
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@') || /\s/.test(value)) return false;
  const dot = value.indexOf('.', at + 2);
  return dot > at + 1 && dot < value.length - 1;
}

export function isEmailHeaderAddress(value: string): boolean {
  return value.length <= 254 && !/[,;<>]/.test(value) && isEmailAddress(value);
}
