const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use Less directly (Less 4 no longer ships `less/dist/less-node.cjs`)
const less = require('less');

const lessPath = path.join(__dirname, 'app', 'style.less');
const cssPath  = path.join(__dirname, 'app', 'style.css');

console.log('🚀 Starting Custom Less Watcher and Next.js Dev Server...');

function compileLess() {
    console.log('🎨 Compiling style.less...');
    const src = fs.readFileSync(lessPath, 'utf8');
    less.render(src, {
        filename: lessPath,          // so @import paths resolve correctly
        paths: [path.dirname(lessPath)],
    })
    .then(output => {
        fs.writeFileSync(cssPath, output.css, 'utf8');
        console.log('✅ style.css updated!');
    })
    .catch(err => {
        console.error(`❌ Less compilation error: ${err.message}`);
        if (err.line) {
            console.error(`   Line ${err.line}, Column ${err.column} in ${err.filename || lessPath}`);
        }
    });
}

// Watch the app folder for any .less changes using fs
let fsWait = false;
try {
    const watchDir = path.dirname(lessPath);
    console.log(`👀 Watching directory for .less changes: ${watchDir}`);
    // Initial compile
    compileLess();

    fs.watch(watchDir, { recursive: true }, (event, filename) => {
        if (filename && filename.endsWith('.less')) {
            if (fsWait) return;
            fsWait = setTimeout(() => {
                fsWait = false;
            }, 100); // Debounce
            compileLess();
        }
    });
} catch (err) {
    console.error(`❌ Failed to set up watcher: ${err.message}`);
}

// Start the Next.js Dev Server
const next = spawn('next', ['dev'], {
    stdio: 'inherit',
    shell: true
});

// Handle exit
next.on('close', (code) => {
    console.log(`Next.js server exited with code ${code}`);
    process.exit(code);
});
