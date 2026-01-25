export function mapToObject(map) {
    const coursesObject = {};
    map.forEach((course, id) => {
        const courseObject = { ...course };

        // Dynamically convert all Map properties to plain objects
        for (const key in courseObject) {
            if (courseObject[key] instanceof Map) {
                courseObject[key] = Object.fromEntries(courseObject[key]);
            }
        }

        coursesObject[id] = courseObject;
    });
    return coursesObject;
}