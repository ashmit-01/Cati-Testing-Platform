export function attachRuntimeEvidence(page, testInfo) {
    const consoleLogs = [];
    const requests = [];
    const responses = [];

  page.on("console", (message) => {
    consoleLogs.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on("request", (request) => {
    const url = request.url();

    requests.push({
      method: request.method(),
      url,
      isApi:
        url.includes("/api/") ||
        url.includes("/api?") ||
        url.includes("/graphql"),
    });
  });
    
  page.on("response", (response) => {
    const url = response.url();

    responses.push({
      status: response.status(),
      url,
      isApi:
        url.includes("/api/") ||
        url.includes("/api?") ||
        url.includes("/graphql"),
    });
  });

  return {
    consoleLogs,
      requests,
    responses,

    async save() {
      await testInfo.attach("console-logs", {
        body: JSON.stringify(consoleLogs, null, 2),
        contentType: "application/json",
      });

      await testInfo.attach("requests", {
        body: JSON.stringify(requests, null, 2),
        contentType: "application/json",
      });
        
      await testInfo.attach("responses", {
        body: JSON.stringify(responses, null, 2),
        contentType: "application/json",
      });
    },
  };
}
