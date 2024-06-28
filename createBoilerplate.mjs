#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import fileContents from './data.json' assert { type: 'json' };

// CSS content to be added to all generated CSS files
const defaultCssContent = `
h1 {
    color: bisque;
}

body {
    background-color: blueviolet;
}
`;

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
            name: 'dbName',
            message: 'Enter the name of the MongoDB database:'
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
        },
        {
            type: 'input',
            name: 'modelFiles',
            message: 'Enter the names of files to create in the models directory (comma separated):'
        }
    ]);

    const projectName = answers.projectName;
    const npmPackages = answers.npmPackages.split(',').map(pkg => pkg.trim()).filter(pkg => pkg);
    const dbName = answers.dbName.trim();
    const serverFiles = answers.serverFiles.split(',').map(file => file.trim());
    const clientFiles = answers.clientFiles.split(',').map(file => file.trim());
    const jsFiles = answers.jsFiles.split(',').map(file => file.trim()).filter(file => file);
    const cssFiles = answers.cssFiles.split(',').map(file => file.trim()).filter(file => file);
    const viewsFiles = answers.viewsFiles.split(',').map(file => file.trim());
    const partialsFiles = answers.partialsFiles.split(',').map(file => file.trim());
    const modelFiles = answers.modelFiles.split(',').map(file => file.trim());

    const projectPath = path.join(targetDir, projectName);

    // Create the main project directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Create subdirectories for client, server, and models
    const directories = [
        'client',
        'client/js',
        'client/css',
        'server',
        'server/views',
        'server/views/partials',
        'models'
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

    // Function to capitalize model names
    const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

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
        const viewRoutes = viewsFiles.map(file => {
            if (file) {
                const fileNameWithoutExt = path.basename(file, '.ejs');
                const cssFileName = `${fileNameWithoutExt}Styles.css`;
                const jsFileName = `${fileNameWithoutExt}Script.js`;
                const viewContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>I'm ${fileNameWithoutExt}</title>
    <link rel="stylesheet" href="/css/${cssFileName}">
    <script src="/js/${jsFileName}" defer></script>
</head>
<body>
    <h1>I'm ${fileNameWithoutExt}</h1>
</body>
</html>`;
                fs.writeFileSync(path.join(projectPath, 'server/views', file), viewContent);
                fs.writeFileSync(path.join(projectPath, 'client/css', cssFileName), defaultCssContent);
                fs.writeFileSync(path.join(projectPath, 'client/js', jsFileName), '');
                return `app.get('/${fileNameWithoutExt}', (req, res) => {
    res.render('${fileNameWithoutExt}');
});`;
            }
            return '';
        }).join('\n');
        partialsFiles.forEach(file => {
            if (file) fs.writeFileSync(path.join(projectPath, 'server/views/partials', file), fileContents[`partials/${file}`] || '');
        });

        // Create specified files in the models directory
        const modelTemplate = name => `
const mongoose = require('mongoose');

const ${name}Schema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    }
});

const ${name} = mongoose.model('${name}', ${name}Schema);
module.exports = ${name};
        `.trim();

        modelFiles.forEach(file => {
            if (file) {
                const modelName = capitalize(path.basename(file, '.js'));
                fs.writeFileSync(path.join(projectPath, 'models', file), modelTemplate(modelName));
            }
        });

        // Generate require statements for models
        const modelRequires = modelFiles.map(file => {
            const modelName = capitalize(path.basename(file, '.js'));
            return `const ${modelName} = require('../models/${file}');`;
        }).join('\n') + '\n';

        // Base index.js content without express
        const baseIndexJsContent = `
${modelRequires}

const path = require('path');
const bodyParser = require('body-parser'); // Middleware to parse request body
const mongoose = require('mongoose'); // Import mongoose

const app = require('express')(); // Assumes express is one of the installed packages

// Middleware to serve static files from the client directory
app.use(require('express').static(path.join(__dirname, '..', 'client', 'public')));

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/${dbName}', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("MONGO CONNECTION OPEN!!!")
    })
    .catch(err => {
        console.log("OH NO MONGO CONNECTION ERROR!!!!")
        console.log(err)
    });

${viewRoutes}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(\`Server is running on port \${PORT}\`);
});
        `;

        // Add the require statements for additional packages
        let additionalRequires = '';
        if (npmPackages.length > 0) {
            additionalRequires = npmPackages.map(pkg => `const ${pkg} = require('${pkg}');`).join('\n') + '\n';
        }

        const indexJsContent = additionalRequires + baseIndexJsContent.trim();
        fs.writeFileSync(path.join(projectPath, 'server', 'index.js'), indexJsContent);

        // Create package.json file in the root directory
        const packageJsonContent = {
            name: projectName,
            version: "1.0.0",
            description: "Project",
            main: "server/index.js",
            scripts: {
                start: "node server/index.js",
                dev: "nodemon server/index.js"
            },
            dependencies: npmPackages.reduce((deps, pkg) => {
                deps[pkg] = '*';
                return deps;
            }, {
                "express": "*",
                "ejs": "*",
                "mongoose": "*"
            }),
            devDependencies: {
                nodemon: "^2.0.12"
            },
            author: "",
            license: "ISC"
        };

        fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJsonContent, null, 2));

        // Initialize a new npm project and install packages
        const allPackages = ['express', 'ejs', 'mongoose', ...npmPackages];
        exec(`npm install ${allPackages.join(' ')} && npm install --save-dev nodemon`, { cwd: projectPath }, (installErr, installStdout, installStderr) => {
            if (installErr) {
                console.error(`Error installing npm packages: ${installErr}`);
                return;
            }
            console.log(installStdout);

            // Update index.js content if there are additional packages
            if (npmPackages.length > 0) {
                fs.writeFileSync(path.join(projectPath, 'server', 'index.js'), indexJsContent);
            } else {
                fs.writeFileSync(path.join(projectPath, 'server', 'index.js'), baseIndexJsContent.trim());
            }
        });
    } catch (error) {
        console.error(error.message);
        return;
    }
}

const targetDir = process.argv[2] || process.cwd();
createBoilerplate(targetDir);
