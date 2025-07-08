const vscode = require('vscode');

let serverPort = null;
let portCheckInterval = null;
let statusBarItem = null;

async function checkPorts(startPort, endPort) {
    let lastError = '';
    
    for (let port = startPort; port <= endPort; port++) {
        const url = `http://127.0.0.1:${port}/secret`;
        
        try {
            const res = await fetch(url, {
                method: 'GET'
            });
            if (res.ok) {
                const text = await res.text();
                if (text === '0xdeadbeef') {
                    if (serverPort !== port) {
                        serverPort = port;
                        updateStatusBar(true);
                    }
                    return port;
                }
            }
        } catch (e) {
            lastError = e.message;
        }
    }
    
    if (serverPort !== null) {
        serverPort = null;
        updateStatusBar(false);
    }
    
    return null;
}

function updateStatusBar(isConnected) {
    if (statusBarItem) {
        statusBarItem.text = isConnected ? 'Hydrogen: Connected' : 'Hydrogen: Disconnected';
        statusBarItem.tooltip = isConnected ? `Connected. Click to execute script.` : 'No server connection';
        statusBarItem.command = isConnected ? 'Hydro-VSC.execute' : undefined;
    }
}

function startPortChecking(context) {
    const START_PORT = 6969;
    const END_PORT = 7069;
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = 'Hydrogen: Disconnected';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Initial port check
    checkPorts(START_PORT, END_PORT);
    
    // Set up interval for periodic checking
    portCheckInterval = setInterval(() => {
        checkPorts(START_PORT, END_PORT);
    }, 15000);
    
    // Clean up interval and status bar on extension deactivation
    context.subscriptions.push({
        dispose: () => {
            if (portCheckInterval) {
                clearInterval(portCheckInterval);
            }
            if (statusBarItem) {
                statusBarItem.dispose();
            }
        }
    });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    startPortChecking(context);
    
    const disposable = vscode.commands.registerCommand('Hydro-VSC.execute', async () => {
        try {
            // Get the active text editor's content
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active text editor found.');
                return;
            }
            const scriptContent = editor.document.getText();
            
            // Check if we have a valid port
            if (!serverPort) {
                throw new Error('Hydrogen cannot be found.');
            }
            
            // Send the script content via POST
            const postUrl = `http://127.0.0.1:${serverPort}/execute`;
            const response = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: scriptContent
            });
            
            if (response.ok) {
                vscode.window.showInformationMessage(`Script executed successfully!`);
            } else {
                const errorText = await response.text();
                vscode.window.showErrorMessage(`Whoops! Unable to execute: ${errorText}`);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });
    
    context.subscriptions.push(disposable);
}

function deactivate() {
    if (portCheckInterval) {
        clearInterval(portCheckInterval);
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};