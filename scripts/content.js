function getTimeTaken(startTime, endTime) {
    return (endTime - startTime).toFixed(2)/1000;
}

function getMondayOfCurrentWeek(date) {
    const day = date.getDay();
    const difference = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(difference));
}

function initializeGUI() {
    const calendarContainer = document.getElementById("calendar-container");

    const currentDate = new Date();
    const mondayDate = getMondayOfCurrentWeek(new Date(currentDate));
    console.log("Monday of current week:", mondayDate);

    const div = document.createElement("div");
    div.textContent = "base element";
    calendarContainer.appendChild(div);

    const div2 = document.createElement("div");
    div2.textContent = "im before the base element";
    calendarContainer.insertBefore(div2, div);

    const div3 = document.createElement("div");
    div3.textContent = "im after the base element";
    calendarContainer.appendChild(div3, div);
}

function updateGUI(courseData) {

}

window.addEventListener("load", () => {
    console.log("D2L-Todolist loaded")

    const startTime = performance.now();
    const COURSE_DATA_KEY = "courseData";
    const courseData = {};
    const oldCourseDataMap = new Map(); // {courseId, complete: false}
    const dateContainerMap = new Map(); // {date, dateContainer}

    // initialize GUI
    initializeGUI();

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
        } else {
            //console.log("No course data found in storage.");
            // if check is not accurate
        }
    });

    // setup UI and create oldCourseDataMap

    // save course data before unloading/leaving the page (and periodically)

});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
});