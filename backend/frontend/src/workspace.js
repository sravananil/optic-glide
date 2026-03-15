function createNode(data) {
    const workspace = document.getElementById('ai-workspace');
    
    // 1. Create the new concept container
    const node = document.createElement('div');
    node.className = `node ${data.color}`; // Color logic: Blue/Purple/Cyan
    node.style.backgroundImage = `url(${data.media_url})`;
    
    // 2. Animate entry (Starting Large)
    node.classList.add('active-focus');
    
    // 3. Logic to "Ball Up" previous nodes
    const previousNodes = document.querySelectorAll('.node.active-focus');
    previousNodes.forEach(prev => {
        if (prev !== node) {
            prev.classList.replace('active-focus', 'ball-shape');
            // Add the name tag to the ball as per your UI requirement
            prev.setAttribute('data-name', data.concept);
        }
    });

    workspace.appendChild(node);
}