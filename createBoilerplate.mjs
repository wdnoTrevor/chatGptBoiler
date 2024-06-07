#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import inquirer from 'inquirer';

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
            name: 'rootFiles',
            message: 'Enter the names of files to create in the root directory (comma separated):'
        },
        {
            type: 'input',
            name: 'dataFiles',
            message: 'Enter the names of files to create in the data directory (comma separated):'
        },
        {
            type: 'input',
            name: 'publicFiles',
            message: 'Enter the names of files to create in the public directory (comma separated):'
        },
        {
            type: 'input',
            name: 'viewsFiles',
            message: 'Enter the names of files to create in the views directory (comma separated):'
        }
    ]);

    const projectName = answers.projectName;
    const npmPackages = answers.npmPackages.split(',').map(pkg => pkg.trim());
    const rootFiles = answers.rootFiles.split(',').map(file => file.trim());
    const dataFiles = answers.dataFiles.split(',').map(file => file.trim());
    const publicFiles = answers.publicFiles.split(',').map(file => file.trim());
    const viewsFiles = answers.viewsFiles.split(',').map(file => file.trim());

    const projectPath = path.join(targetDir, projectName);

    // Create the main project directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Create subdirectories
    const directories = ['data', 'public', 'views', 'views/partials'];
    directories.forEach(dir => {
        fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    });

    // Create specified files in the respective directories
    rootFiles.forEach(file => {
        if (file) fs.writeFileSync(path.join(projectPath, file), '');
    });
    dataFiles.forEach(file => {
        if (file) fs.writeFileSync(path.join(projectPath, 'data', file), '');
    });
    publicFiles.forEach(file => {
        if (file) fs.writeFileSync(path.join(projectPath, 'public', file), '');
    });
    viewsFiles.forEach(file => {
        if (file) fs.writeFileSync(path.join(projectPath, 'views', file), '');
    });

    // Initial content for index.js
    let indexContent = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

app.listen(port, () => {
    console.log(\`Server is running on port \${port}\`);
});`;

    // Write initial content to index.js
    fs.writeFileSync(path.join(projectPath, 'index.js'), indexContent);

    // Change the current working directory to the project directory
    process.chdir(projectPath);

    // Initialize a new npm project and install packages
    exec('npm init -y', (initErr, initStdout, initStderr) => {
        if (initErr) {
            console.error(`Error initializing npm project: ${initErr}`);
            return;
        }
        console.log(initStdout);

        if (npmPackages.length > 0) {
            exec(`npm install ${npmPackages.join(' ')}`, (installErr, installStdout, installStderr) => {
                if (installErr) {
                    console.error(`Error installing npm packages: ${installErr}`);
                    return;
                }
                console.log(installStdout);

                // Add require statements for the installed packages in index.js
                const additionalPackages = npmPackages.filter(pkg => pkg !== 'express');
                const requireStatements = additionalPackages.map(pkg => `const ${pkg} = require('${pkg}');`).join('\n') + '\n';
                const updatedIndexContent = requireStatements + '\n' + indexContent;
                fs.writeFileSync(path.join(projectPath, 'index.js'), updatedIndexContent);
            });
        }
    });
}

const targetDir = process.argv[2] || process.cwd();
createBoilerplate(targetDir);
