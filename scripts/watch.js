import { TMDB_API_KEY } from "./config.js";
import { 
  findVietnameseSubtitles, 
  downloadSubtitleFile, 
  displaySubtitles, 
  createSubtitleToggle,
  createSubtitleUpload
} from "./subtitles.js";

const calculateElapsedTime = (timeCreated) => {
  const created = new Date(timeCreated).getTime();
  let periods = {
    year: 365 * 30 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
  };
  let diff = Date.now() - created;

  for (const key in periods) {
    if (diff >= periods[key]) {
      let result = Math.floor(diff / periods[key]);
      return `${result} ${result === 1 ? key : key + "s"} ago`;
    }
  }

  return "Just now";
};

const searchQuery = new URLSearchParams(location.search);

const movieId = searchQuery.get("id");

if (!movieId) location.href = "./index.html";

const labels = ["data", "similar"];

(async () => {
  const result = (
    await Promise.all([
      (
        await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`
        )
      ).json(),
      (
        await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${TMDB_API_KEY}`
        )
      ).json(),
    ])
  ).reduce((final, current, index) => {
    if (labels[index] === "data") {
      final[labels[index]] = current;
    } else if (labels[index] === "similar") {
      final[labels[index]] = current.results;
    }

    return final;
  }, {});

  console.log(result);

  document.querySelector(
    "iframe"
  ).src = `https://www.2embed.cc/embed/${result.data.id}`;
  document.querySelector("#movie-title").innerText =
    result.data.title || result.data.name;
  document.querySelector("#movie-description").innerText = result.data.overview;

  if (result.data.release_date)
    document.querySelector(
      "#release-date"
    ).innerText = `Release Date: ${result.data.release_date}`;

  if (result.similar && result.similar.length > 0)
    document.querySelector("#similar").innerHTML += /*html*/ `
    <h1 className="text-xl">Similar Movies</h1>
    ${result.similar
      .map(
        (item) => /*html*/ `<a href="./info.html?id=${item.id}">
          <div>
            <img
              onload="this.style.opacity = '1'"
              alt=""
              src="https://image.tmdb.org/t/p/w200${item.poster_path}"
            />
            <div>
              <p>${item.title}</p>
            </div>
          </div>
        </a>`
      )
      .join("")} 
  `;

  
  const user = JSON.parse(localStorage.getItem("currentUser"));

  ///// Lập trình tính năng comment trong trang
  document.querySelector("#comment-box-container").innerHTML = /*html*/ `
  <form ${
    !user ? 'style="cursor: pointer" onclick="signIn()"' : ""
  } class="comment-form" autocomplete="off">
    <img src="${
      user
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            user?.username
          )}`
        : `./assets/default-avatar.png`
    }" />

    <div ${!user ? "onclick='location.href = \"./login.html\"'" : ""}>
      <input
        required
        type="text"
        placeholder="${
          user ? `Comment as ${user.username}` : "Sign in to comment"
        }"
        id="comment"
        name="comment"
        ${user ? "" : "style='pointer-events: none'"}
      />
      <button type="submit"
        ${user ? "" : 'style="display: none"'}
       ><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </form>
  `;

  const form = document.querySelector("form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = e.target.comment.value.trim();

    e.target.comment.value = "";

    const existingComments = JSON.parse(
      localStorage.getItem(`comments-${movieId}`) || "[]"
    );

    existingComments.push({
      title,
      user: {
        username: user.username,
      },
      createdAt: Date.now(),
    });

    localStorage.setItem(
      `comments-${movieId}`,
      JSON.stringify(existingComments)
    );

    renderComments();
  });

  window.renderComments = () => {
    let out = "";

    const comments = JSON.parse(
      localStorage.getItem(`comments-${movieId}`) || "[]"
    );

    comments.forEach((comment) => {
      out += /*html*/ `
        <div class="comment-item">
          <img src="${
            comment.user.photoURL ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
              comment.user.username
            )}`
          }" />
          <div>
            <div>
              <strong>${comment.user.username}</strong>
              <p>${comment.title}</p>
            </div>
           <p>${calculateElapsedTime(comment.createdAt)}</p>
          </div>
        </div> 
      `;
    });
    document.querySelector("#comments").innerHTML = out;
  };

  document.querySelector(".backdrop").classList.add("backdrop-hidden");

  renderComments();

  document.title = `Watch ${
    result.data.title || result.data.name
  } - Duy Khanh`;

  // Tải và hiển thị phụ đề tiếng Việt
  try {
    const movieTitle = result.data.title || result.data.name;
    const releaseDate = result.data.release_date;
    
    // Hiển thị thông báo đang tải phụ đề
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'subtitle-loading';
    loadingMessage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      z-index: 2000;
      font-size: 16px;
    `;
    loadingMessage.textContent = 'Đang tải phụ đề tiếng Việt...';
    document.body.appendChild(loadingMessage);
    
    // Tìm phụ đề tiếng Việt
    const subtitleInfo = await findVietnameseSubtitles(movieId, movieTitle, releaseDate);
    
    if (subtitleInfo) {
      // Tải file phụ đề
      const subtitles = await downloadSubtitleFile(subtitleInfo);
      
      if (subtitles && subtitles.length > 0) {
        // Hiển thị phụ đề
        const subtitleController = displaySubtitles(subtitles, null);
        
        if (subtitleController) {
          // Tạo nút bật/tắt phụ đề
          createSubtitleToggle(subtitleController);
          
          // Tạo nút upload phụ đề
          createSubtitleUpload(subtitleController);
          
          // Vì iframe từ domain khác, chúng ta cần một cách để theo dõi thời gian
          // Sử dụng một timer để ước tính thời gian (người dùng có thể điều chỉnh)
          let currentTime = 0;
          let isPlaying = false;
          let timeOffset = 0; // Offset để đồng bộ thủ công
          
          // Tạo UI để điều chỉnh đồng bộ phụ đề
          const syncControls = document.createElement('div');
          syncControls.id = 'subtitle-sync-controls';
          syncControls.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 10px;
            z-index: 1002;
            color: white;
            font-size: 14px;
            display: none;
          `;
          syncControls.innerHTML = `
            <div style="margin-bottom: 10px;">
              <label>Đồng bộ phụ đề (giây):</label>
              <div style="display: flex; gap: 10px; margin-top: 5px; align-items: center;">
                <button id="sync-back" style="padding: 5px 10px; cursor: pointer;">-1s</button>
                <span id="sync-offset">0</span>
                <button id="sync-forward" style="padding: 5px 10px; cursor: pointer;">+1s</button>
                <button id="sync-reset" style="padding: 5px 10px; cursor: pointer; margin-left: 10px;">Reset</button>
              </div>
            </div>
            <div>
              <label>Thời gian hiện tại: <span id="current-time-display">0:00</span></label>
            </div>
          `;
          document.body.appendChild(syncControls);
          
          // Xử lý nút đồng bộ
          document.getElementById('sync-back').addEventListener('click', () => {
            timeOffset -= 1;
            document.getElementById('sync-offset').textContent = timeOffset;
            updateSubtitleTime();
          });
          
          document.getElementById('sync-forward').addEventListener('click', () => {
            timeOffset += 1;
            document.getElementById('sync-offset').textContent = timeOffset;
            updateSubtitleTime();
          });
          
          document.getElementById('sync-reset').addEventListener('click', () => {
            timeOffset = 0;
            document.getElementById('sync-offset').textContent = timeOffset;
            updateSubtitleTime();
          });
          
          // Hàm cập nhật thời gian phụ đề
          function updateSubtitleTime() {
            const adjustedTime = currentTime + timeOffset;
            subtitleController.update(adjustedTime);
            
            // Cập nhật hiển thị thời gian
            const minutes = Math.floor(adjustedTime / 60);
            const seconds = Math.floor(adjustedTime % 60);
            document.getElementById('current-time-display').textContent = 
              `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
          
          // Timer để cập nhật phụ đề (giả sử video đang phát)
          // Người dùng có thể bấm play/pause để điều khiển
          const playPauseButton = document.createElement('button');
          playPauseButton.id = 'subtitle-play-pause';
          playPauseButton.innerHTML = '<i class="fa-solid fa-play"></i>';
          playPauseButton.title = 'Play/Pause để đồng bộ phụ đề';
          playPauseButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 80px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--orange, #ff6b35);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 20px;
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          `;
          
          let subtitleInterval = null;
          
          playPauseButton.addEventListener('click', () => {
            isPlaying = !isPlaying;
            playPauseButton.innerHTML = isPlaying 
              ? '<i class="fa-solid fa-pause"></i>' 
              : '<i class="fa-solid fa-play"></i>';
            
            if (isPlaying) {
              subtitleInterval = setInterval(() => {
                currentTime += 0.1;
                updateSubtitleTime();
              }, 100);
              syncControls.style.display = 'block';
            } else {
              if (subtitleInterval) {
                clearInterval(subtitleInterval);
                subtitleInterval = null;
              }
            }
          });
          
          document.body.appendChild(playPauseButton);
          
          // Nút hiển thị/ẩn controls đồng bộ
          const syncToggleButton = document.createElement('button');
          syncToggleButton.id = 'subtitle-sync-toggle';
          syncToggleButton.innerHTML = '<i class="fa-solid fa-clock"></i>';
          syncToggleButton.title = 'Điều chỉnh đồng bộ phụ đề';
          syncToggleButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 140px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--blue, #007bff);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 20px;
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          `;
          
          syncToggleButton.addEventListener('click', () => {
            syncControls.style.display = syncControls.style.display === 'none' ? 'block' : 'none';
          });
          
          document.body.appendChild(syncToggleButton);
          
          loadingMessage.textContent = 'Đã tải phụ đề tiếng Việt thành công!';
          setTimeout(() => {
            loadingMessage.remove();
          }, 2000);
        } else {
          loadingMessage.textContent = 'Không thể hiển thị phụ đề.';
          setTimeout(() => {
            loadingMessage.remove();
          }, 2000);
        }
      } else {
        loadingMessage.textContent = 'Không tìm thấy file phụ đề.';
        setTimeout(() => {
          loadingMessage.remove();
        }, 2000);
      }
    } else {
      loadingMessage.textContent = 'Không tìm thấy phụ đề tiếng Việt cho phim này.';
      setTimeout(() => {
        loadingMessage.remove();
      }, 3000);
    }
  } catch (error) {
    console.error("Error loading subtitles:", error);
  }
})();
