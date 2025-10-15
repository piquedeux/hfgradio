document.addEventListener("DOMContentLoaded", async () => {
    const liveBanner = document.getElementById('liveBanner');
    const airtimeContainer = document.getElementById('airtime-player-container');
    const offlineNotification = document.getElementById('offlineNotification');
    const nowPlayingText = document.getElementById('nowPlayingText');
    const nextUpText = document.getElementById('nextUpText');
    const currentShowTitle = document.getElementById('currentShowTitle');
    const currentShowImage = document.getElementById('currentShowImage');
    const toggleHeader = document.getElementById('toggleHeader');
    const showsContainer = document.getElementById('showsContainer');
    const toggleCalendar = document.getElementById('toggleCalendar');
    const calendarContainer = document.getElementById('calendarContainer');
    const calendarContent = document.getElementById('calendarContent');

    offlineNotification.style.display = 'none';
    let isPlaying = false;

    async function checkLiveShow() {
        try {
            const response = await fetch('https://hfgradio.airtime.pro/api/live-info');
            const data = await response.json();

            const currentShow = data?.currentShow?.[0];

            if (currentShow) {
                const now = new Date();
                const startTime = new Date(currentShow.starts);
                const endTime = new Date(currentShow.ends);

                if (now >= startTime && now <= endTime) {
                    liveBanner.classList.add('show');
                    offlineNotification.classList.remove('show');

                    document.querySelectorAll('.marquee-content').forEach(content => {
                        content.style.animation = '';
                    });

                    currentShowTitle.textContent = currentShow.name || 'Untitled Show';

                    // Fallback zur Standardgrafik, falls kein Bild gefunden
                    currentShowImage.src = `https://hfgradio.airtime.pro/api/show-logo?id=${currentShow.id}`;
                    currentShowImage.onerror = () => {
                        currentShowImage.src = '/icon.png';
                    };

                    isPlaying = true;
                    return;
                }
            }
            handleOfflineState();
        } catch (error) {
            console.error('Failed to fetch live show info:', error);
            handleOfflineState();
        }
    }

    function handleOfflineState() {
        liveBanner.classList.remove('show');
        offlineNotification.classList.add('show');

        document.querySelectorAll('.marquee-content').forEach(content => {
            content.style.animation = 'none';
        });

        isPlaying = false;
    }

    offlineNotification.addEventListener('click', () => {
        offlineNotification.classList.add('hide');
        offlineNotification.classList.remove('show');
        showsContainer.classList.add('show');
        toggleHeader.querySelector('text').textContent = 'ARCHIVE ▲';
        setTimeout(() => {
            showsContainer.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    });

    setInterval(checkLiveShow, 30000);
    checkLiveShow();

    function updateClock() {
        const now = new Date();
        document.getElementById('clockText').textContent = now.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    setInterval(updateClock, 1000);
    updateClock();

    async function updateTrackInfo() {
        try {
            const response = await fetch('https://hfgradio.airtime.pro/api/live-info');
            const data = await response.json();

            const currentTrack = `${data?.current?.name || ''} ${data?.current?.title || ''}`.trim();
            const nextTrack = `${data?.next?.name || ''} ${data?.next?.title || ''}`.trim();

            nowPlayingText.textContent = currentTrack || 'No track information';
            nextUpText.textContent = nextTrack || 'No upcoming track information';
        } catch (error) {
            console.error('Failed to fetch track info:', error);
        }
    }

    setInterval(updateTrackInfo, 30000);
    updateTrackInfo();

    toggleHeader.addEventListener('click', () => {
        showsContainer.classList.toggle('show');
        toggleHeader.querySelector('text').textContent = showsContainer.classList.contains('show')
            ? 'ARCHIVE ▲'
            : 'ARCHIVE ▼';
    });

    if (document.getElementById('mobileChatButton')) {
        document.getElementById('mobileChatButton').addEventListener('click', () => {
            window.open('https://chatango.com/box?hfgstation', '_blank');
        });
    }

    toggleCalendar.addEventListener('click', () => {
        calendarContainer.classList.toggle('show');
        toggleCalendar.querySelector('text').textContent = calendarContainer.classList.contains('show')
            ? 'UPCOMING SHOWS ▲'
            : 'UPCOMING SHOWS ▼';

        if (!calendarContainer.classList.contains('show')) {
            calendarContainer.querySelectorAll('.show-inner').forEach(card => {
                card.style.transform = 'rotateY(0)';
            });
        }
    });

    async function updateShowSchedules() {
        try {
            const response = await fetch('https://hfgradio.airtime.pro/api/week-info');
            const data = await response.json();

            calendarContent.innerHTML = '';
            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let showsFound = 0;

            for (const [dayName, shows] of Object.entries(data)) {
                if (Array.isArray(shows)) {
                    for (const show of shows) {
                        const showDate = new Date(show.starts);
                        if (showDate > now) {
                            const showDay = showDate.getDay();
                            const instagramHandle = show.description?.match(/@([a-zA-Z0-9._]+)/)?.[1];

                            const showElement = document.createElement('div');
                            showElement.className = 'calendar-item';

                            showElement.innerHTML = `
                                <div class="show-inner">
                                    <div class="show-front">
                                        <div class="calendar-time">
                                            <span class="day">${days[showDay]}</span>
                                            <span class="time">${showDate.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}</span>
                                        </div>
                                        <div class="calendar-details">
                                            <h3>${show.name || 'Untitled Show'}</h3>
                                            <p>${show.description || 'No description available'}</p>
                                        </div>
                                    </div>
                                    ${instagramHandle ? `
                                        <div class="show-back">
                                            <button class="back-button"></button>
                                            <iframe 
                                                src="https://www.instagram.com/${instagramHandle}/embed" 
                                                frameborder="0" 
                                                scrolling="no" 
                                                allowtransparency="true"
                                                width="100%"
                                                height="100%">
                                            </iframe>
                                        </div>
                                    ` : ''}
                                </div>
                            `;

                            if (instagramHandle) {
                                const showInner = showElement.querySelector('.show-inner');
                                const backButton = showElement.querySelector('.back-button');

                                showElement.addEventListener('click', (e) => {
                                    if (!e.target.classList.contains('back-button')) {
                                        showInner.style.transform = 'rotateY(180deg)';
                                    }
                                });

                                backButton.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    showInner.style.transform = 'rotateY(0)';
                                });
                            }

                            calendarContent.appendChild(showElement);
                            showsFound++;
                        }
                    }
                }
            }

            if (showsFound === 0) {
                calendarContent.innerHTML = '<p>No upcoming shows scheduled</p>';
            }
        } catch (error) {
            console.error('Failed to fetch show schedules:', error);
            calendarContent.innerHTML = '<p>Failed to load show schedules</p>';
        }
    }

    setInterval(updateShowSchedules, 300000);
    updateShowSchedules();
});
