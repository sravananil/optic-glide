const socket = new WebSocket('ws://localhost:8000/ws/room/mastered_doctor');

socket.onopen = () => {
    console.log("Connected to OpticGlide Backend");
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // This is where we trigger the "Ball" creation in the Workspace
    createNode(data); 
};

socket.onclose = () => {
    console.log("Connection closed");
};

export default socket;