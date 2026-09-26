function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

export function parseAssertionError(message = "", errorContext = "") {
  const cleanMessage = stripAnsi(message);
  const cleanContext = stripAnsi(errorContext);
  const lines = cleanMessage.split("\n");

  // Format 1:
  // Expected: 3
  // Received: 2
  const expectedLine = lines.find((line) =>
    line.trim().startsWith("Expected:"),
  );

  const receivedLine = lines.find((line) =>
    line.trim().startsWith("Received:"),
  );

  if (expectedLine && receivedLine) {
    return {
      expected: expectedLine.replace(/^.*Expected:\s*/, "").trim() || null,
      actual: receivedLine.replace(/^.*Received:\s*/, "").trim() || null,
    };
  }

  // Format 2:
  // Expected pattern: /.../
  // Received string: "..."
  const expectedPatternLine = lines.find((line) =>
    line.trim().startsWith("Expected pattern:"),
  );

  const receivedStringLine = lines.find((line) =>
    line.trim().startsWith("Received string:"),
  );

  if (expectedPatternLine && receivedStringLine) {
    return {
      expected:
        expectedPatternLine
          .replace(/^.*Expected pattern:\s*/, "")
          .trim()
          .replace(/\\\\/g, "\\") || null,

      actual:
        receivedStringLine.replace(/^.*Received string:\s*/, "").trim() || null,
    };
  }

  // Format 3:
  // Expected: visible
  // Error: element(s) not found
  const expectedVisibilityLine = lines.find((line) =>
    line.trim().startsWith("Expected:"),
  );

  const elementErrorLine = lines.find((line) =>
    line.trim().startsWith("Error: element(s) not found"),
  );

  if (expectedVisibilityLine && elementErrorLine) {
    return {
      expected:
        expectedVisibilityLine.replace(/^.*Expected:\s*/, "").trim() || null,

      actual: "element(s) not found",
    };
  }

  // Format 4:
  // Expected substring / Received string
  const receivedIndex = lines.findIndex((line) =>
    line.includes("Received string"),
  );

  if (receivedIndex !== -1) {
    const expectedLines = [];
    const actualLines = [];

    for (let i = receivedIndex + 1; i < lines.length; i++) {
      if (lines[i].includes("Call log:")) {
        break;
      }

      const line = lines[i].trim();

      if (line.startsWith("-")) {
        const value = line.replace(/^-+\s*/, "").trim();

        if (value) {
          expectedLines.push(value);
        }
      }

      if (line.startsWith("+")) {
        const value = line.replace(/^\+\s*/, "").trim();

        if (value) {
          actualLines.push(value);
        }
      }
    }

    return {
      expected: expectedLines.join("\n") || null,
      actual: actualLines.join("\n") || null,
    };
  }

  // Fallback: Playwright assertion details from error-context.md
  const contextExpected = cleanContext.match(/Expected pattern:\s*(.+)/);

  const contextActual = cleanContext.match(/Received string:\s*"([^"]+)"/);

  if (contextExpected && contextActual) {
    return {
      expected: contextExpected[1].trim(),
      actual: contextActual[1].trim(),
    };
  }

  return { expected: null, actual: null };
}
