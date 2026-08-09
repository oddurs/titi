export type Node =
  | { t: "num"; v: number; raw: string }
  | { t: "const"; name: string }
  | { t: "var"; name: string }
  | { t: "list"; name: string }
  | { t: "yref"; name: string }
  | { t: "matref"; name: string }
  | { t: "seqref"; name: string }
  | { t: "matlit"; rows: Node[][] }
  | { t: "call"; name: string; args: Node[] }
  | { t: "bin"; op: string; l: Node; r: Node; implicit?: boolean }
  | { t: "neg"; e: Node }
  | { t: "post"; op: string; e: Node }
  | { t: "listlit"; items: Node[] }
  | { t: "store"; e: Node; target: string };

export class ParseError extends Error {
  constructor(
    message: string,
    /** caret position to jump to when the user chooses "Goto" */
    public at = 0,
  ) {
    super(message);
    this.name = "ParseError";
  }
}
