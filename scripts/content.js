function getTimeTaken(startTime, endTime) {
    return (endTime - startTime).toFixed(2)/1000;
}

window.addEventListener("load", () => {
    console.log("D2L-Todolist loaded")

    const startTime = performance.now();
    const COURSE_DATA_KEY = "courseData";
    const courseData = {};
    const oldCourseDataMap = new Map();

    // fetch new data first in case it is faster than storage retrieval
    // fetch  course data and update storage
    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {

        // save course data to storage
        chrome.storage.local.set({ courseData: response }, function() {
            Object.assign(courseData, response);
        });

        console.log("Fetched course data:", courseData);
        console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to fetch course data");
    });

    // set courseData from storage if it exists
    chrome.storage.local.get([COURSE_DATA_KEY], function(result) {
        if (result.courseData && courseData.isEmpty !== false) {
            Object.assign(courseData, result.courseData);
            console.log("Course data from storage:", courseData);
            console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to load stored course data");
            console.warn("My dumbass loaded AFTER we got data!");
        } else {
            //console.log("No course data found in storage.");
            // if check is not accurate
        }
    });

    // setup UI and create oldCourseDataMap
    console.warn("My dumbass loaded before we got data!");

    // save course data before unloading/leaving the page (and periodically)

});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
});