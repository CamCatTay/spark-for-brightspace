window.addEventListener("load", () => {
    console.log("D2L-Todolist loaded")
    const startTime = performance.now();

    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {
        
        console.log("Course content:", response);

        const endTime = performance.now(); // Record the end time
        const timeTaken = (endTime - startTime).toFixed(2)/1000;
        console.log("It took " + timeTaken + "s to fetch course content");

    });
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
});