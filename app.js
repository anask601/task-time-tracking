class TaskTimeTracker {
    constructor() {
        this.currentTask = null;
        this.startTime = null;
        this.elapsedTime = 0;
        this.savedElapsedTime = 0; // FIXED: Store elapsed time when paused
        this.isRunning = false;
        this.isPaused = false;
        this.taskHistory = this.loadTaskHistory();
        this.remindersEnabled = true;
        this.reminderInterval = null;
        this.timerInterval = null;
        this.focusResponses = [];
        this.lastReminderTime = null;
        
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
        this.updateStatistics();
        this.initializeNotifications();
        this.registerServiceWorker();
        this.initializePWA();
    }

    initializeElements() {
        this.elements = {
            taskNameInput: document.getElementById('taskNameInput'),
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopBtn: document.getElementById('stopBtn'),
            currentTime: document.getElementById('currentTime'),
            taskStatus: document.getElementById('taskStatus'),
            currentTaskDisplay: document.getElementById('currentTaskDisplay'),
            totalTimeToday: document.getElementById('totalTimeToday'),
            tasksCompletedToday: document.getElementById('tasksCompletedToday'),
            focusScore: document.getElementById('focusScore'),
            enableReminders: document.getElementById('enableReminders'),
            nextReminderIn: document.getElementById('nextReminderIn'),
            taskHistory: document.getElementById('taskHistory'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            exportBtn: document.getElementById('exportBtn'),
            focusModal: document.getElementById('focusModal'),
            focusYesBtn: document.getElementById('focusYesBtn'),
            focusNoBtn: document.getElementById('focusNoBtn'),
            modalCountdown: document.getElementById('modalCountdown'),
            statusIndicator: document.getElementById('statusIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            installBanner: document.getElementById('installBanner'),
            installBtn: document.getElementById('installBtn'),
            dismissInstallBtn: document.getElementById('dismissInstallBtn')
        };
    }

    bindEvents() {
        // FIXED: Direct function calls instead of changing onclick
        this.elements.startBtn.addEventListener('click', () => {
            if (this.isPaused) {
                this.resumeTask();
            } else {
                this.startTask();
            }
        });
        
        this.elements.pauseBtn.addEventListener('click', () => this.pauseTask());
        this.elements.stopBtn.addEventListener('click', () => this.stopTask());

        // Settings
        this.elements.enableReminders.addEventListener('change', (e) => {
            this.remindersEnabled = e.target.checked;
            if (this.remindersEnabled && this.isRunning) {
                this.startReminderTimer();
            } else {
                this.stopReminderTimer();
            }
        });

        // History controls
        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.elements.exportBtn.addEventListener('click', () => this.exportToCSV());

        // Focus modal
        this.elements.focusYesBtn.addEventListener('click', () => this.handleFocusResponse(true));
        this.elements.focusNoBtn.addEventListener('click', () => this.handleFocusResponse(false));

        // Install banner
        this.elements.dismissInstallBtn.addEventListener('click', () => {
            this.elements.installBanner.style.display = 'none';
            localStorage.setItem('installDismissed', 'true');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        if (this.isPaused) {
                            this.resumeTask();
                        } else if (!this.isRunning && this.elements.taskNameInput.value.trim()) {
                            this.startTask();
                        }
                        break;
                    case 'p':
                        e.preventDefault();
                        if (this.isRunning) {
                            this.pauseTask();
                        } else if (this.isPaused) {
                            this.resumeTask();
                        }
                        break;
                    case 'q':
                        e.preventDefault();
                        if (this.isRunning || this.isPaused) this.stopTask();
                        break;
                }
            }
        });

        // Update button states when user types in task name
        this.elements.taskNameInput.addEventListener('input', () => {
            this.updateButtonStates();
            this.saveToLocalStorage();
        });

        this.elements.taskNameInput.addEventListener('paste', () => {
            setTimeout(() => {
                this.updateButtonStates();
                this.saveToLocalStorage();
            }, 10);
        });

        this.elements.taskNameInput.addEventListener('cut', () => {
            setTimeout(() => {
                this.updateButtonStates();
                this.saveToLocalStorage();
            }, 10);
        });

        // Enter key to start task or resume if paused
        this.elements.taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.isPaused) {
                    this.resumeTask();
                } else if (!this.isRunning && this.elements.taskNameInput.value.trim()) {
                    this.startTask();
                }
            }
        });

        this.elements.taskNameInput.addEventListener('blur', () => {
            this.updateButtonStates();
        });
    }

    async initializeNotifications() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('ServiceWorker registered successfully');
            } catch (error) {
                console.log('ServiceWorker registration failed: ', error);
            }
        }
    }

    initializePWA() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            if (!localStorage.getItem('installDismissed')) {
                this.elements.installBanner.style.display = 'block';
            }
        });

        this.elements.installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                this.elements.installBanner.style.display = 'none';
            }
        });
    }

    startTask() {
        const taskName = this.elements.taskNameInput.value.trim();
        if (!taskName) {
            this.showNotification('Please enter a task name', 'error');
            this.elements.taskNameInput.focus();
            return;
        }

        this.currentTask = taskName;
        this.startTime = new Date();
        this.isRunning = true;
        this.isPaused = false;
        this.elapsedTime = 0;
        this.savedElapsedTime = 0; // FIXED: Reset saved time for new task

        this.updateButtonStates();
        this.startTimer();
        
        if (this.remindersEnabled) {
            this.startReminderTimer();
        }

        this.showNotification(`Started task: ${taskName}`, 'success');
        this.elements.connectionStatus.textContent = 'Running';
    }

    pauseTask() {
        if (!this.isRunning) return;
        
        // FIXED: Save current elapsed time before stopping
        this.savedElapsedTime = this.elapsedTime;
        
        this.isRunning = false;
        this.isPaused = true;
        
        this.stopTimer(); // FIXED: This actually stops the timer now
        this.stopReminderTimer();
        
        this.updateButtonStates();
        this.showNotification(`Paused task: ${this.currentTask}`, 'warning');
        this.elements.connectionStatus.textContent = 'Paused';
        
        console.log('Task paused at:', this.formatTime(this.savedElapsedTime));
    }

    resumeTask() {
        if (!this.isPaused) return;

        // FIXED: Start timer from saved elapsed time
        this.startTime = new Date() - this.savedElapsedTime; // Adjust start time
        this.isRunning = true;
        this.isPaused = false;

        this.updateButtonStates();
        this.startTimer();
        
        if (this.remindersEnabled) {
            this.startReminderTimer();
        }

        this.showNotification(`Resumed task: ${this.currentTask}`, 'success');
        this.elements.connectionStatus.textContent = 'Running';
        
        console.log('Task resumed from:', this.formatTime(this.savedElapsedTime));
    }

    stopTask() {
        const endTime = new Date();
        const finalDuration = this.isPaused ? this.savedElapsedTime : this.elapsedTime;

        // Save completed task
        const taskRecord = {
            id: Date.now(),
            name: this.currentTask,
            startTime: this.startTime,
            endTime: endTime,
            duration: finalDuration,
            focusResponses: [...this.focusResponses]
        };

        this.taskHistory.unshift(taskRecord);
        this.saveTaskHistory();

        // FIXED: Reset all state properly
        this.currentTask = null;
        this.startTime = null;
        this.elapsedTime = 0;
        this.savedElapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.focusResponses = [];

        this.stopTimer();
        this.stopReminderTimer();
        this.updateButtonStates();
        this.updateDisplay();
        this.updateStatistics();
        this.renderTaskHistory();

        this.elements.taskNameInput.value = '';
        this.elements.taskNameInput.focus();

        this.showNotification(`Completed task! Duration: ${this.formatTime(finalDuration)}`, 'success');
        this.elements.connectionStatus.textContent = 'Ready';
    }

    startTimer() {
        // FIXED: Clear any existing timer first
        this.stopTimer();
        
        this.timerInterval = setInterval(() => {
            // FIXED: Simple calculation from start time
            this.elapsedTime = new Date() - this.startTime;
            this.updateDisplay();
        }, 1000);
        
        console.log('Timer started');
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('Timer stopped');
        }
    }

    startReminderTimer() {
        this.stopReminderTimer();
        this.lastReminderTime = Date.now();
        
        this.reminderInterval = setInterval(() => {
            this.showFocusReminder();
        }, 5 * 60 * 1000); // 5 minutes
    }

    stopReminderTimer() {
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = null;
        }
    }

    showFocusReminder() {
        this.elements.focusModal.style.display = 'block';
        this.startModalCountdown();

        // Browser notification
        if (Notification.permission === 'granted') {
            new Notification('Focus Check! 🔔', {
                body: 'Are you still focused on your current task?',
                icon: 'icon-192.png',
                badge: 'icon-72.png',
                tag: 'focus-reminder',
                requireInteraction: true
            });
        }
    }

    startModalCountdown() {
        let countdown = 10;
        this.elements.modalCountdown.textContent = countdown;

        const countdownInterval = setInterval(() => {
            countdown--;
            this.elements.modalCountdown.textContent = countdown;

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.closeFocusModal();
            }
        }, 1000);

        this.modalCountdownInterval = countdownInterval;
    }

    handleFocusResponse(isFocused) {
        this.focusResponses.push({
            time: new Date(),
            focused: isFocused
        });

        if (!isFocused) {
            this.showNotification('Consider taking a 2-3 minute break to refresh your mind!', 'info');
        }

        this.closeFocusModal();
        this.updateFocusScore();
    }

    closeFocusModal() {
        this.elements.focusModal.style.display = 'none';
        if (this.modalCountdownInterval) {
            clearInterval(this.modalCountdownInterval);
        }
    }

    updateButtonStates() {
        const hasTaskName = this.elements.taskNameInput.value.trim().length > 0;
        
        if (this.isRunning) {
            // Task is currently running
            this.elements.startBtn.disabled = true;
            this.elements.startBtn.innerHTML = '<span class="btn-icon">▶️</span> Start';
            this.elements.pauseBtn.disabled = false;
            this.elements.stopBtn.disabled = false;
        } else if (this.isPaused) {
            // Task is paused - start button becomes resume
            this.elements.startBtn.disabled = false;
            this.elements.startBtn.innerHTML = '<span class="btn-icon">▶️</span> Resume';
            this.elements.pauseBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
        } else {
            // Ready state - no active task
            this.elements.startBtn.disabled = !hasTaskName;
            this.elements.startBtn.innerHTML = '<span class="btn-icon">▶️</span> Start';
            this.elements.pauseBtn.disabled = true;
            this.elements.stopBtn.disabled = true;
        }

        // Remove any inline styles that might interfere
        this.elements.startBtn.style.opacity = '';
        this.elements.startBtn.style.cursor = '';
    }

    updateDisplay() {
        // FIXED: Use appropriate time based on state
        const displayTime = this.isPaused ? this.savedElapsedTime : this.elapsedTime;
        this.elements.currentTime.textContent = this.formatTime(displayTime);

        // Task status
        if (this.isRunning) {
            this.elements.taskStatus.textContent = 'Running';
            this.elements.currentTaskDisplay.textContent = this.currentTask;
        } else if (this.isPaused) {
            this.elements.taskStatus.textContent = 'Paused';
            this.elements.currentTaskDisplay.textContent = this.currentTask;
        } else {
            this.elements.taskStatus.textContent = 'Ready to start';
            this.elements.currentTaskDisplay.textContent = 'No active task';
        }

        // Next reminder countdown
        if (this.isRunning && this.remindersEnabled && this.lastReminderTime) {
            const elapsed = Date.now() - this.lastReminderTime;
            const remaining = (5 * 60 * 1000) - elapsed;
            if (remaining > 0) {
                this.elements.nextReminderIn.textContent = this.formatTime(remaining);
            } else {
                this.elements.nextReminderIn.textContent = '00:00';
            }
        } else {
            this.elements.nextReminderIn.textContent = this.remindersEnabled ? '05:00' : 'Disabled';
        }
    }

    updateStatistics() {
        const today = new Date().toDateString();
        const todayTasks = this.taskHistory.filter(task => 
            new Date(task.startTime).toDateString() === today
        );

        // Total time today
        const totalTime = todayTasks.reduce((sum, task) => sum + task.duration, 0);
        this.elements.totalTimeToday.textContent = this.formatTime(totalTime);

        // Tasks completed today
        this.elements.tasksCompletedToday.textContent = todayTasks.length;

        // Update focus score
        this.updateFocusScore();
    }

    updateFocusScore() {
        if (this.focusResponses.length === 0) {
            this.elements.focusScore.textContent = '100%';
            return;
        }

        const focusedResponses = this.focusResponses.filter(r => r.focused).length;
        const totalResponses = this.focusResponses.length;
        const score = Math.round((focusedResponses / totalResponses) * 100);
        
        this.elements.focusScore.textContent = `${score}%`;
        
        // Update color based on score
        if (score >= 80) {
            this.elements.focusScore.style.color = 'var(--success-color)';
        } else if (score >= 60) {
            this.elements.focusScore.style.color = 'var(--warning-color)';
        } else {
            this.elements.focusScore.style.color = 'var(--danger-color)';
        }
    }

    renderTaskHistory() {
        const historyContainer = this.elements.taskHistory;
        
        if (this.taskHistory.length === 0) {
            historyContainer.innerHTML = '<div class="no-tasks">No completed tasks yet</div>';
            return;
        }

        const historyHTML = this.taskHistory.slice(0, 20).map(task => `
            <div class="task-item">
                <div class="task-name">${this.escapeHtml(task.name)}</div>
                <div class="task-duration">${this.formatTime(task.duration)}</div>
                <div class="task-time">${new Date(task.startTime).toLocaleTimeString()}</div>
                <div class="task-date">${new Date(task.startTime).toLocaleDateString()}</div>
            </div>
        `).join('');

        historyContainer.innerHTML = historyHTML;
    }

    formatTime(milliseconds) {
        if (!milliseconds || milliseconds < 0) milliseconds = 0;
        
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: inherit; cursor: pointer;">×</button>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : 
                       type === 'warning' ? 'var(--warning-color)' : 
                       type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
            color: white;
            padding: 12px 16px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all task history?')) {
            this.taskHistory = [];
            this.saveTaskHistory();
            this.renderTaskHistory();
            this.updateStatistics();
            this.showNotification('Task history cleared', 'info');
        }
    }

    exportToCSV() {
        if (this.taskHistory.length === 0) {
            this.showNotification('No tasks to export', 'warning');
            return;
        }

        const csvContent = [
            ['Task Name', 'Start Time', 'End Time', 'Duration (minutes)', 'Focus Score'],
            ...this.taskHistory.map(task => [
                task.name,
                new Date(task.startTime).toLocaleString(),
                new Date(task.endTime).toLocaleString(),
                Math.round(task.duration / 60000 * 100) / 100,
                this.calculateTaskFocusScore(task)
            ])
        ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-history-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.showNotification('Task history exported', 'success');
    }

    calculateTaskFocusScore(task) {
        if (!task.focusResponses || task.focusResponses.length === 0) {
            return '100%';
        }

        const focusedCount = task.focusResponses.filter(r => r.focused).length;
        const totalCount = task.focusResponses.length;
        return `${Math.round((focusedCount / totalCount) * 100)}%`;
    }

    loadTaskHistory() {
        try {
            const history = localStorage.getItem('taskHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading task history:', error);
            return [];
        }
    }

    saveTaskHistory() {
        try {
            localStorage.setItem('taskHistory', JSON.stringify(this.taskHistory));
        } catch (error) {
            console.error('Error saving task history:', error);
        }
    }

    saveToLocalStorage() {
        try {
            const state = {
                currentTask: this.currentTask,
                startTime: this.startTime,
                elapsedTime: this.elapsedTime,
                savedElapsedTime: this.savedElapsedTime, // FIXED: Save the paused time
                isRunning: this.isRunning,
                isPaused: this.isPaused,
                remindersEnabled: this.remindersEnabled,
                taskName: this.elements.taskNameInput.value
            };
            localStorage.setItem('appState', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving app state:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const state = localStorage.getItem('appState');
            if (state) {
                const parsed = JSON.parse(state);
                
                if (parsed.taskName) {
                    this.elements.taskNameInput.value = parsed.taskName;
                }
                
                if (parsed.remindersEnabled !== undefined) {
                    this.remindersEnabled = parsed.remindersEnabled;
                    this.elements.enableReminders.checked = parsed.remindersEnabled;
                }

                // FIXED: Restore running or paused task properly
                if ((parsed.isRunning || parsed.isPaused) && parsed.startTime && parsed.currentTask) {
                    this.currentTask = parsed.currentTask;
                    this.isRunning = parsed.isRunning;
                    this.isPaused = parsed.isPaused;
                    this.savedElapsedTime = parsed.savedElapsedTime || 0;
                    
                    if (this.isRunning) {
                        // FIXED: Restore running task with proper time calculation
                        const now = new Date();
                        const savedStartTime = new Date(parsed.startTime);
                        const timeElapsedSinceClose = now - savedStartTime;
                        
                        this.startTime = now - timeElapsedSinceClose;
                        this.elapsedTime = timeElapsedSinceClose;
                        
                        this.startTimer();
                        
                        if (this.remindersEnabled) {
                            this.startReminderTimer();
                        }
                        
                        this.showNotification('Restored running task', 'info');
                    } else if (this.isPaused) {
                        // FIXED: Restore paused task with saved time
                        this.elapsedTime = this.savedElapsedTime;
                        this.showNotification('Restored paused task - click Resume to continue', 'info');
                    }
                    
                    this.updateButtonStates();
                    this.updateDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading app state:', error);
        }
    }

    // Initialize the app
    init() {
        this.loadFromLocalStorage();
        this.renderTaskHistory();
        this.updateButtonStates();
        
        // Auto-save every 30 seconds
        setInterval(() => {
            this.saveToLocalStorage();
        }, 30000);

        // Update display every second
        setInterval(() => {
            this.updateDisplay();
        }, 1000);

        // Save state before page unload
        window.addEventListener('beforeunload', () => {
            this.saveToLocalStorage();
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveToLocalStorage();
            } else {
                // FIXED: Sync time when returning to tab only if running
                if (this.isRunning && this.startTime) {
                    this.elapsedTime = new Date() - this.startTime;
                    this.updateDisplay();
                }
            }
        });

        console.log('Task Time Tracker initialized successfully');
    }
}

// Add notification styles to head
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(300px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(notificationStyles);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new TaskTimeTracker();
    app.init();
});