console.log('Content script loaded');

window.addEventListener("load", function() {
    getCourseInformation();
}, false); 

function getBaseURL() {
    return window.location.protocol + "//" + window.location.host;
}

async function getCourseInformation() {
    try {
        let baseURL = getBaseURL();
            const response = await fetch(baseURL + "/d2l/api/lp/1.43/enrollments/myenrollments/");
            if (!response.ok) {
                throw new Error(`HTTP error. Status: ${response.status}`);
            }
            const data = await response.json();
            console.log(data);
    } catch (error) {
        console.error("Error fetching JSON:", error);
    }
}