// Script để tải và hiển thị phụ đề tiếng Việt
// Sử dụng nhiều nguồn phụ đề

// Hàm tìm phụ đề tiếng Việt cho phim
export async function findVietnameseSubtitles(movieId, movieTitle, releaseDate) {
  try {
    // Thử nhiều phương pháp để tìm phụ đề
    
    // Phương pháp 1: Sử dụng YIFY Subtitles API (công khai, không cần auth)
    try {
      const yifyUrl = `https://yifysubtitles.org/api/subtitles/${movieId}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yifyUrl)}`;
      
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (data.contents) {
        const parsedData = JSON.parse(data.contents);
        if (parsedData.subtitles && parsedData.subtitles.length > 0) {
          // Tìm phụ đề tiếng Việt
          const vietnameseSub = parsedData.subtitles.find(
            sub => sub.lang === "Vietnamese" || sub.lang === "vi" || sub.langCode === "vi"
          );
          
          if (vietnameseSub && vietnameseSub.url) {
            return {
              url: vietnameseSub.url,
              lang: "vi",
              source: "yify"
            };
          }
        }
      }
    } catch (error) {
      console.log("YIFY API error:", error);
    }
    
    // Phương pháp 2: Sử dụng OpenSubtitles (qua proxy)
    try {
      const year = releaseDate ? releaseDate.split("-")[0] : null;
      const searchQuery = encodeURIComponent(movieTitle);
      const yearQuery = year ? `&year=${year}` : "";
      
      // Sử dụng một proxy công khai
      const opensubtitlesUrl = `https://rest.opensubtitles.org/search/query-${searchQuery}/sublanguageid-vie${yearQuery}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(opensubtitlesUrl)}`;
      
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (data.contents) {
        const parsedData = JSON.parse(data.contents);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Sắp xếp theo rating
          parsedData.sort((a, b) => (b.SubRating || 0) - (a.SubRating || 0));
          const bestSub = parsedData[0];
          
          if (bestSub.SubDownloadLink) {
            return {
              url: bestSub.SubDownloadLink,
              lang: "vi",
              source: "opensubtitles"
            };
          }
        }
      }
    } catch (error) {
      console.log("OpenSubtitles API error:", error);
    }
    
    // Phương pháp 3: Sử dụng Subscene (qua web scraping proxy)
    // Bỏ qua vì phức tạp
    
    return null;
  } catch (error) {
    console.error("Error finding subtitles:", error);
    return null;
  }
}


// Tải file phụ đề (SRT)
export async function downloadSubtitleFile(subtitleInfo) {
  try {
    if (!subtitleInfo || !subtitleInfo.url) {
      return null;
    }
    
    const downloadUrl = subtitleInfo.url;
    
    // Sử dụng proxy để tải file
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(downloadUrl)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (!data.contents) {
      return null;
    }
    
    // Parse SRT content
    return parseSRT(data.contents);
  } catch (error) {
    console.error("Error downloading subtitle file:", error);
    return null;
  }
}

// Parse file SRT thành array các subtitle objects
function parseSRT(srtContent) {
  if (!srtContent) return [];
  
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) return;
    
    const timeLine = lines[1];
    const text = lines.slice(2).join('\n');
    
    // Parse time: 00:00:00,000 --> 00:00:05,000
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (timeMatch) {
      const startTime = parseTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = parseTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
      
      subtitles.push({
        start: startTime,
        end: endTime,
        text: text.replace(/<[^>]+>/g, '').trim() // Remove HTML tags
      });
    }
  });
  
  return subtitles;
}

// Convert time string to seconds
function parseTime(hours, minutes, seconds, milliseconds) {
  return parseInt(hours) * 3600 + 
         parseInt(minutes) * 60 + 
         parseInt(seconds) + 
         parseInt(milliseconds) / 1000;
}

// Hiển thị phụ đề trên video
export function displaySubtitles(subtitles, videoElement) {
  if (!subtitles || subtitles.length === 0) {
    return null;
  }
  
  // Tạo container cho phụ đề
  const subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'subtitle-container';
  subtitleContainer.style.cssText = `
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 1000;
    pointer-events: none;
    max-width: 90%;
  `;
  
  const subtitleText = document.createElement('div');
  subtitleText.id = 'subtitle-text';
  subtitleText.style.cssText = `
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 18px;
    font-weight: 500;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    line-height: 1.4;
    display: none;
  `;
  
  subtitleContainer.appendChild(subtitleText);
  
  // Tìm container video
  const videoContainer = document.querySelector('.iframe-container') || 
                         document.querySelector('main') ||
                         document.body;
  
  if (videoContainer) {
    videoContainer.style.position = 'relative';
    videoContainer.appendChild(subtitleContainer);
  }
  
  // Hàm cập nhật phụ đề theo thời gian
  let currentSubtitleIndex = 0;
  
  function updateSubtitle(currentTime) {
    // Tìm phụ đề phù hợp với thời gian hiện tại
    let activeSubtitle = null;
    
    for (let i = 0; i < subtitles.length; i++) {
      if (currentTime >= subtitles[i].start && currentTime <= subtitles[i].end) {
        activeSubtitle = subtitles[i];
        currentSubtitleIndex = i;
        break;
      }
    }
    
    if (activeSubtitle) {
      subtitleText.textContent = activeSubtitle.text;
      subtitleText.style.display = 'block';
    } else {
      subtitleText.style.display = 'none';
    }
  }
  
  // Lắng nghe sự kiện từ iframe (nếu có thể)
  // Vì iframe từ domain khác, chúng ta cần một cách khác để theo dõi thời gian
  
  return {
    update: updateSubtitle,
    container: subtitleContainer,
    show: () => subtitleText.style.display = 'block',
    hide: () => subtitleText.style.display = 'none',
    toggle: () => {
      const isVisible = subtitleText.style.display !== 'none';
      subtitleText.style.display = isVisible ? 'none' : 'block';
      return !isVisible;
    }
  };
}

// Cho phép người dùng upload file phụ đề
export function createSubtitleUpload(subtitleController) {
  const uploadButton = document.createElement('button');
  uploadButton.id = 'subtitle-upload';
  uploadButton.innerHTML = '<i class="fa-solid fa-upload"></i>';
  uploadButton.title = 'Upload phụ đề (SRT)';
  uploadButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 200px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--green, #28a745);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 20px;
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.3s;
  `;
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.srt,.vtt';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      const subtitles = parseSRT(text);
      
      if (subtitles && subtitles.length > 0) {
        // Cập nhật phụ đề
        const container = document.getElementById('subtitle-container');
        if (container) {
          container.remove();
        }
        
        const newController = displaySubtitles(subtitles, null);
        if (newController && subtitleController) {
          // Cập nhật controller
          Object.assign(subtitleController, newController);
          
          alert(`Đã tải ${subtitles.length} dòng phụ đề thành công!`);
        }
      } else {
        alert('Không thể đọc file phụ đề. Vui lòng kiểm tra định dạng file.');
      }
    }
  });
  
  uploadButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  uploadButton.addEventListener('mouseenter', () => {
    uploadButton.style.transform = 'scale(1.1)';
  });
  
  uploadButton.addEventListener('mouseleave', () => {
    uploadButton.style.transform = 'scale(1)';
  });
  
  document.body.appendChild(uploadButton);
  document.body.appendChild(fileInput);
  
  return uploadButton;
}

// Tạo nút bật/tắt phụ đề
export function createSubtitleToggle(subtitleController) {
  const toggleButton = document.createElement('button');
  toggleButton.id = 'subtitle-toggle';
  toggleButton.innerHTML = '<i class="fa-solid fa-closed-captioning"></i>';
  toggleButton.title = 'Bật/Tắt phụ đề';
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--red, #e50914);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 20px;
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.3s;
  `;
  
  toggleButton.addEventListener('mouseenter', () => {
    toggleButton.style.transform = 'scale(1.1)';
  });
  
  toggleButton.addEventListener('mouseleave', () => {
    toggleButton.style.transform = 'scale(1)';
  });
  
  let isEnabled = true;
  
  toggleButton.addEventListener('click', () => {
    isEnabled = subtitleController.toggle();
    toggleButton.style.opacity = isEnabled ? '1' : '0.5';
  });
  
  document.body.appendChild(toggleButton);
  
  return toggleButton;
}

