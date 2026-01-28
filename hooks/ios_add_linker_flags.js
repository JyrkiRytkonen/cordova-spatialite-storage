#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const projectRoot = context.opts.projectRoot;
    const platformPath = path.join(projectRoot, 'platforms/ios');
    
    // Use cordova-ios API for compatibility (works with cordova-ios 5.0.0+)
    let appName = 'App'; // Default
    try {
        const cordova_ios = require('cordova-ios');
        const iosProject = new cordova_ios.Api('ios', platformPath);
        appName = path.basename(iosProject.locations.xcodeCordovaProj);
        console.log('Detected iOS app name:', appName);
    } catch (e) {
        // Fallback for older setups
        try {
            const files = fs.readdirSync(platformPath);
            const xcodeprojFile = files.find(f => f.endsWith('.xcodeproj'));
            if (xcodeprojFile) {
                appName = xcodeprojFile.replace('.xcodeproj', '');
                console.log('Detected iOS app name (fallback):', appName);
            }
        } catch (err) {
            console.log('Error detecting app name, using default:', appName);
        }
    }
    
    const buildDebugXcconfig = path.join(platformPath, 'cordova/build-debug.xcconfig');
    const buildReleaseXcconfig = path.join(platformPath, 'cordova/build-release.xcconfig');

    const headerSearchPath = `"$(SRCROOT)/${appName}/Plugins/cordova-spatialite-storage/common"`;
    const librarySearchPath = `"$(SRCROOT)/${appName}/Resources/lib"`;
    const linkerFlags = '-lproj -lgeos_c -lgeos -lspatialite -lsqlite3';

    function updateXcconfig(filePath) {
        if (!fs.existsSync(filePath)) {
            console.log('File not found:', filePath);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove old spatialite-related entries first
        content = content.replace(/^HEADER_SEARCH_PATHS = .*cordova-spatialite-storage.*$/gm, '');
        content = content.replace(/^LIBRARY_SEARCH_PATHS = .*cordova-spatialite-storage.*$/gm, '');
        content = content.replace(/^OTHER_LDFLAGS = .*spatialite.*$/gm, '');
        
        // Clean up any double newlines
        content = content.replace(/\n{3,}/g, '\n\n');
        
        // Add HEADER_SEARCH_PATHS
        if (content.includes('HEADER_SEARCH_PATHS =')) {
            content = content.replace(
                /HEADER_SEARCH_PATHS = (.*)/,
                `HEADER_SEARCH_PATHS = $1 ${headerSearchPath}`
            );
        } else {
            content += `\nHEADER_SEARCH_PATHS = ${headerSearchPath}\n`;
        }

        // Add LIBRARY_SEARCH_PATHS
        if (content.includes('LIBRARY_SEARCH_PATHS =')) {
            content = content.replace(
                /LIBRARY_SEARCH_PATHS = (.*)/,
                `LIBRARY_SEARCH_PATHS = $1 ${librarySearchPath}`
            );
        } else {
            content += `\nLIBRARY_SEARCH_PATHS = ${librarySearchPath}\n`;
        }

        // Add OTHER_LDFLAGS - preserve existing flags including -ObjC
        if (content.includes('OTHER_LDFLAGS =')) {
            // Check if spatialite flags are already present
            if (!content.includes('-lspatialite')) {
                content = content.replace(
                    /OTHER_LDFLAGS = ([^\n]*)/,
                    (match, existingFlags) => {
                        const flags = existingFlags.trim();
                        return `OTHER_LDFLAGS = ${flags} ${linkerFlags}`;
                    }
                );
            }
        } else {
            // For cordova-ios 7+, ensure -ObjC is included
            content += `\nOTHER_LDFLAGS = -ObjC ${linkerFlags}\n`;
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }

    updateXcconfig(buildDebugXcconfig);
    updateXcconfig(buildReleaseXcconfig);
};
