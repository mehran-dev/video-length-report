const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Function to get duration of a video file
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration || 0;
      resolve(duration); // Duration in seconds
    });
  });
};

// Function to recursively get video durations in directories
const getDurationsInDirectory = async (dir) => {
  let totalDuration = 0;
  const folderDurations = {};

  const processDirectory = async (directory, relativePath = '') => {
    const files = await readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        await processDirectory(filePath, path.join(relativePath, file));
      } else if (file.endsWith('.mp4') || file.endsWith('.mkv') || file.endsWith('.mov')) {
        try {
          const duration = await getVideoDuration(filePath);
          totalDuration += duration;

          if (!folderDurations[relativePath]) folderDurations[relativePath] = 0;
          folderDurations[relativePath] += duration;
        } catch (error) {
          console.error(`Error getting duration for ${file}:`, error);
        }
      }
    }
  };

  await processDirectory(dir);
  return { totalDuration, folderDurations };
};

// Convert seconds to hours, minutes, seconds
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
};

// Main function to select directory, calculate durations, and generate report
const main = async () => {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Please provide a directory path as an argument.");
    return;
  }

  try {
    console.log(`Selected directory: ${dir}`);

    const { totalDuration, folderDurations } = await getDurationsInDirectory(dir);

    // Generate report
    let report = `Video Length Report\nSelected Directory: ${dir}\n\n`;
    report += `Total Duration: ${formatDuration(totalDuration)}\n\n`;
    report += `Per Folder Duration:\n`;

    for (const [folder, duration] of Object.entries(folderDurations)) {
      report += `${folder || 'Root'}: ${formatDuration(duration)}\n`;
    }

    // Write report to a text file
    const reportPath = path.join(dir, 'video_length_report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`Report generated at: ${reportPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
};

main();
 
