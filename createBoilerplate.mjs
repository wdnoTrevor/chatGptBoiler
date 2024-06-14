#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import fileContents from './data.json' assert { type: 'json' };

async function createBoilerplate(targetDir) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Enter the name of the directory:'
        },
        {
            type: 'input',
            name: 'npmPackages',
            message: 'Enter npm packages to install (comma separated):'
        },
        {
            type: 'input',
            name: 'serverFiles',
            message: 'Enter the names of files to create in the server directory (comma separated):'
        },
        {
            type: 'input',
            name: 'clientFiles',
            message: 'Enter the names of files to create in the client directory (comma separated):'
        },
        {
            type: 'input',
            name: 'jsFiles',
            message: 'Enter the names of files to create in the client/js directory (comma separated):'
        },
        {
            type: 'input',
            name: 'cssFiles',
            message: 'Enter the names of files to create in the client/css directory (comma separated):'
        },
        {
            type: 'input',
            name: 'viewsFiles',
            message: 'Enter the names of files to create in the server/views directory (comma separated):'
        },
        {
            type: 'input',
            name: 'partialsFiles',
            message: 'Enter the names of files to create in the server/views/partials directory (comma separated):'
        }
    ]);

    const projectName = answers.projectName;
    const npmPackages = answers.npmPackages.split(',').map(pkg => pkg.trim());
    const serverFiles = answers.serverFiles.split(',').map(file => file.trim());
    const clientFiles = answers.clientFiles.split(',').map(file => file.trim());
    const jsFiles = answers.jsFiles.split(',').map(file => file.trim());
    const cssFiles = answers.cssFiles.split(',').map(file => file.trim());
    const viewsFiles = answers.viewsFiles.split(',').map(file => file.trim());
    const partialsFiles = answers.partialsFiles.split(',').map(file => file.trim());

    const projectPath = path.join(targetDir, projectName);

    // Create the main project directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Create subdirectories for client and server
    const directories = [
        'client',
        'client/js',
        'client/css',
        'server',
        'server/views',
        'server/views/partials'
    ];
    directories.forEach(dir => {
        fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    });

    // Function to normalize and validate file names
    const normalizeFiles = (files, extension) => {
        return files.map(file => {
            if (!file.endsWith(extension)) {
                if (extension === '.js' && file.endsWith('.css')) {
                    file = file.replace('.css', extension);
                } else if (extension === '.css' && file.endsWith('.js')) {
                    file = file.replace('.js', extension);
                } else {
                    file += extension;
                }
            }
            return file;
        });
    };

    try {
        // Normalize and validate js and css files
        const normalizedJsFiles = normalizeFiles(jsFiles, '.js');
        const normalizedCssFiles = normalizeFiles(cssFiles, '.css');

        // Create specified files in the respective directories
        serverFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'server', file), fileContents[file] || '');
        });
        clientFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'client', file), fileContents[file] || '');
        });
        normalizedJsFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'client/js', file), fileContents[`client/js/${file}`] || '');
        });
        normalizedCssFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'client/css', file), fileContents[`client/css/${file}`] || '');
        });
        viewsFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'server/views', file), fileContents[file] || '');
        });
        partialsFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'server/views/partials', file), fileContents[`partials/${file}`] || '');
        });
    } catch (error) {
        console.error(error.message);
        return;
    }

    // Create index.js file in the server directory with additional required content
    const indexJsContent = `
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser'); // Middleware to parse request body

const app = express();

// Middleware to serve static files from the client directory
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(\`Server is running on port \${PORT}\`);
});
    `;
    fs.writeFileSync(path.join(projectPath, 'server', 'index.js'), indexJsContent.trim());

    // Create package.json file in the server directory
    const packageJsonContent = {
        name: "server",
        version: "1.0.0",
        description: "Server for the project",
        main: "index.js",
        scripts: {
            start: "node index.js",
            dev: "nodemon index.js"
        },
        dependencies: {},
        devDependencies: {
            nodemon: "^2.0.12"
        },
        author: "",
        license: "ISC"
    };

    fs.writeFileSync(path.join(projectPath, 'server', 'package.json'), JSON.stringify(packageJsonContent, null, 2));

    // Change the current working directory to the server directory
    process.chdir(path.join(projectPath, 'server'));

    // Initialize a new npm project and install packages
    exec('npm init -y', (initErr, initStdout, initStderr) => {
        if (initErr) {
            console.error(`Error initializing npm project: ${initErr}`);
            return;
        }
        console.log(initStdout);

        // Include 'ejs' in npm packages to install
        const allPackages = [...npmPackages, 'ejs'];
        exec(`npm install ${allPackages.join(' ')} && npm install --save-dev nodemon`, (installErr, installStdout, installStderr) => {
            if (installErr) {
                console.error(`Error installing npm packages: ${installErr}`);
                return;
            }
            console.log(installStdout);

            // Add require statements for the installed packages in index.js
            const additionalPackages = npmPackages.filter(pkg => pkg !== 'express');
            const requireStatements = additionalPackages.map(pkg => `const ${pkg} = require('${pkg}');`).join('\n') + '\n';
            const updatedIndexContent = requireStatements + '\n' + indexJsContent.trim();
            fs.writeFileSync(path.join(projectPath, 'server', 'index.js'), updatedIndexContent);
        });
    });
}

const targetDir = process.argv[2] || process.cwd();
createBoilerplate(targetDir);
