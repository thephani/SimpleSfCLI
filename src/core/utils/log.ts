export class Log {
  static info(message: string): void {
    console.log(message);
  }

  static warn(message: string): void {
    console.warn(message);
  }

  static error(message: string): void {
    console.error(message);
  }
}
