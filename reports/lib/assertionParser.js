function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

export function parseAssertionError(message = "") {
  const cleanMessage = stripAnsi(message);
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

  return {
    expected: null,
    actual: null,
  };
}
