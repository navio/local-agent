declare module "marked-terminal" {
  import { Renderer } from "marked";
  class TerminalRenderer extends Renderer {
    constructor(options?: any);
  }
  export = TerminalRenderer;
}