function format(tag, message) {
  return `[queuestorm] [${tag}] ${message}`;
}

export function info(tag, message) {
  console.log(format(tag, message));
}

export function warn(tag, message) {
  console.warn(format(tag, message));
}

export function error(tag, message) {
  console.error(format(tag, message));
}
