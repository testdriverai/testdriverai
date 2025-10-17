// Source mapping functionality for YAML files using AST parsing
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const yamlAst = require("@stoplight/yaml-ast-parser");
const theme = require("./theme.js");

class SourceMapper {
  constructor() {
    // Current execution state
    this.currentFileSourceMap = null; // AST and source mapping for current file
    this.currentStepIndex = -1; // Index of current step being executed
    this.currentCommandIndex = -1; // Index of current command within step
    this.currentFilePath = null; // Path of current file being executed
  }

  // Parse YAML with AST to create source mapping
  parseYamlWithSourceMap(yamlContent, filePath) {
    try {
      // Parse with AST
      const ast = yamlAst.load(yamlContent);

      // Parse with js-yaml for the actual data
      const yamlObj = yaml.load(yamlContent);

      // Create source mapping
      const sourceMap = this.createSourceMap(
        ast,
        yamlObj,
        filePath,
        yamlContent,
      );

      return {
        yamlObj,
        sourceMap,
        ast,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse YAML with source mapping: ${error.message}`,
      );
    }
  }

  // Convert character position to line/column
  positionToLineColumn(content, position) {
    const lines = content.substring(0, position).split("\n");
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  }

  // Create source mapping from AST
  createSourceMap(ast, yamlObj, filePath, yamlContent) {
    const sourceMap = {
      filePath,
      steps: [],
      version: null,
    };

    if (!ast || ast.kind !== yamlAst.Kind.MAP) {
      return sourceMap;
    }

    // Find version and steps in the AST
    for (const mapping of ast.mappings || []) {
      if (mapping.key && mapping.key.value === "version") {
        const startPos = this.positionToLineColumn(
          yamlContent,
          mapping.startPosition || 0,
        );
        const endPos = this.positionToLineColumn(
          yamlContent,
          mapping.endPosition || 0,
        );
        sourceMap.version = {
          startLine: startPos.line,
          startColumn: startPos.column,
          endLine: endPos.line,
          endColumn: endPos.column,
        };
      } else if (mapping.key && mapping.key.value === "steps") {
        sourceMap.steps = this.mapStepsSourcePositions(
          mapping.value,
          yamlObj.steps || [],
          yamlContent,
        );
      }
    }

    return sourceMap;
  }

  // Map source positions for steps and their commands
  mapStepsSourcePositions(stepsNode, stepsData, yamlContent) {
    const stepsMapped = [];

    if (!stepsNode || stepsNode.kind !== yamlAst.Kind.SEQ) {
      return stepsMapped;
    }

    stepsNode.items.forEach((stepNode, stepIndex) => {
      const stepData = stepsData[stepIndex] || {};
      const startPos = this.positionToLineColumn(
        yamlContent,
        stepNode.startPosition || 0,
      );
      const endPos = this.positionToLineColumn(
        yamlContent,
        stepNode.endPosition || 0,
      );

      const stepMap = {
        stepIndex,
        startLine: startPos.line,
        startColumn: startPos.column,
        endLine: endPos.line,
        endColumn: endPos.column,
        prompt: null,
        commands: [],
      };

      if (stepNode.kind === yamlAst.Kind.MAP) {
        for (const mapping of stepNode.mappings || []) {
          if (mapping.key && mapping.key.value === "prompt") {
            const promptStartPos = this.positionToLineColumn(
              yamlContent,
              mapping.startPosition || 0,
            );
            const promptEndPos = this.positionToLineColumn(
              yamlContent,
              mapping.endPosition || 0,
            );
            stepMap.prompt = {
              startLine: promptStartPos.line,
              startColumn: promptStartPos.column,
              endLine: promptEndPos.line,
              endColumn: promptEndPos.column,
            };
          } else if (mapping.key && mapping.key.value === "commands") {
            stepMap.commands = this.mapCommandsSourcePositions(
              mapping.value,
              stepData.commands || [],
              yamlContent,
            );
          }
        }
      }

      stepsMapped.push(stepMap);
    });

    return stepsMapped;
  }

  // Map source positions for commands within a step
  mapCommandsSourcePositions(commandsNode, commandsData, yamlContent) {
    const commandsMapped = [];

    if (!commandsNode || commandsNode.kind !== yamlAst.Kind.SEQ) {
      return commandsMapped;
    }

    commandsNode.items.forEach((commandNode, commandIndex) => {
      const commandData = commandsData[commandIndex] || {};
      const startPos = this.positionToLineColumn(
        yamlContent,
        commandNode.startPosition || 0,
      );
      const endPos = this.positionToLineColumn(
        yamlContent,
        commandNode.endPosition || 0,
      );

      const commandMap = {
        commandIndex,
        startLine: startPos.line,
        startColumn: startPos.column,
        endLine: endPos.line,
        endColumn: endPos.column,
        command: commandData.command || null,
      };

      commandsMapped.push(commandMap);
    });

    return commandsMapped;
  }

  // Set the current execution context
  setCurrentContext(filePath, sourceMap, stepIndex = -1, commandIndex = -1) {
    this.currentFilePath = filePath;
    this.currentFileSourceMap = sourceMap;
    this.currentStepIndex = stepIndex;
    this.currentCommandIndex = commandIndex;
  }

  // Update current step index
  setCurrentStep(stepIndex) {
    this.currentStepIndex = stepIndex;
    this.currentCommandIndex = -1; // Reset command index when changing steps
  }

  // Update current command index
  setCurrentCommand(commandIndex) {
    this.currentCommandIndex = commandIndex;
  }

  // Save current execution context (for embedded files)
  saveContext() {
    return {
      filePath: this.currentFilePath,
      sourceMap: this.currentFileSourceMap,
      stepIndex: this.currentStepIndex,
      commandIndex: this.currentCommandIndex,
    };
  }

  // Restore execution context (for embedded files)
  restoreContext(context) {
    this.currentFilePath = context.filePath;
    this.currentFileSourceMap = context.sourceMap;
    this.currentStepIndex = context.stepIndex;
    this.currentCommandIndex = context.commandIndex;
  }

  // Get current source position information
  getCurrentSourcePosition() {
    if (!this.currentFileSourceMap || this.currentStepIndex < 0) {
      return null;
    }

    const stepMap = this.currentFileSourceMap.steps[this.currentStepIndex];
    if (!stepMap) {
      return null;
    }

    let commandMap = null;
    if (
      this.currentCommandIndex >= 0 &&
      stepMap.commands[this.currentCommandIndex]
    ) {
      commandMap = stepMap.commands[this.currentCommandIndex];
    }

    return {
      filePath: this.currentFilePath,
      step: stepMap,
      command: commandMap,
    };
  }

  // Get human-readable description of current execution position
  getCurrentPositionDescription() {
    const sourcePosition = this.getCurrentSourcePosition();
    if (!sourcePosition) {
      return "No source position available";
    }

    const fileName = path.basename(sourcePosition.filePath);
    let description = `${fileName}:${(sourcePosition.step.startLine || 0) + 1}`;

    if (sourcePosition.command) {
      description += `:${(sourcePosition.command.startLine || 0) + 1}`;
    } else {
      description += ` (step ${sourcePosition.step.stepIndex + 1})`;
    }

    return description;
  }

  // Show error with source context (3 lines before/after with arrow pointing to error line)
  getErrorWithSourceContext(error, contextLines = 3) {
    const sourcePosition = this.getCurrentSourcePosition();
    if (!sourcePosition || !this.currentFilePath) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(this.currentFilePath, "utf-8");
      const lines = fileContent.split("\n");

      // Determine which line to highlight
      let errorLine = -1;
      if (sourcePosition.command) {
        errorLine = sourcePosition.command.startLine;
      } else if (sourcePosition.step) {
        errorLine = sourcePosition.step.startLine;
      }

      if (errorLine < 0 || errorLine >= lines.length) {
        return null;
      }

      // Calculate range of lines to show
      const startLine = Math.max(0, errorLine - contextLines);
      const endLine = Math.min(lines.length - 1, errorLine + contextLines);

      // Build the context display
      const fileName = path.basename(this.currentFilePath);
      let output = [];

      output.push(theme.red(`Error in ${fileName}:`));
      output.push("");

      for (let i = startLine; i <= endLine; i++) {
        const lineNum = (i + 1).toString().padStart(4, " ");
        const isErrorLine = i === errorLine;
        const prefix = isErrorLine ? theme.red(">>>") : "   ";
        const lineColor = isErrorLine ? theme.red : theme.dim;

        output.push(
          `${theme.dim(lineNum)} ${prefix} ${lineColor(lines[i] || "")}`,
        );
      }

      output.push("");
      output.push(theme.yellow(`Error: ${error.message || error}`));

      return output.join("\n");
    } catch {
      // If we can't read the file or there's any error, return null
      return null;
    }
  }

  // Get a concise error message with position info
  getErrorWithPosition(error) {
    const positionDesc = this.getCurrentPositionDescription();
    const errorMsg = error.message || error.toString();

    if (positionDesc !== "No source position available") {
      return `${theme.red("Error")} at ${theme.yellow(positionDesc)}: ${errorMsg}`;
    }

    return `${theme.red("Error")}: ${errorMsg}`;
  }
}

module.exports = SourceMapper;
