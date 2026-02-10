// ============================================================================
// GACHA SLOT COUNTER - Main Logic
// ============================================================================

class GachaTracker {
    constructor() {
        // State
        this.totalPulls = 0;
        this.sessionPulls = 0;
        this.sessionCount = 0;
        this.slotSelections = {};
        this.slotCounters = {};
        this.pullHistory = [];
        this.historyFile = 'gacha_pull_history.json';

        // Initialize slots
        for (let i = 1; i <= 5; i++) {
            const slotName = `Slot${i}`;
            this.slotSelections[slotName] = null;
            this.slotCounters[slotName] = 0;
        }

        // Load saved data
        this.loadPullHistory();
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectColor(e));
        });

        // Counter buttons
        document.querySelectorAll('.slot-counter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.incrementCounter(e));
        });

        // Confirm button
        const confirmBtn = document.getElementById('gacha-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmPull());
        }

        // Back button
        const backBtn = document.getElementById('gacha-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.clearSelections());
        }

        // History controls
        const exportBtn = document.getElementById('gacha-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportHistory());
        }

        const importBtn = document.getElementById('gacha-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                document.getElementById('gacha-import-file').click();
            });
        }

        const importFile = document.getElementById('gacha-import-file');
        if (importFile) {
            importFile.addEventListener('change', (e) => this.importHistory(e));
        }

        const clearBtn = document.getElementById('gacha-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearHistory());
        }
    }

    selectColor(event) {
        const button = event.target.closest('.color-btn');
        if (!button) return;

        const slotName = button.dataset.slot;
        const colorName = button.dataset.color;

        // Update selection
        this.slotSelections[slotName] = colorName;

        // Update UI - highlight selected color and show color name
        const slotBox = document.querySelector(`[data-slot="${slotName}"]`);
        if (slotBox) {
            // Remove previous selection
            slotBox.querySelectorAll('.color-btn').forEach(btn => {
                btn.classList.remove('selected');
            });

            // Add selection to clicked button
            button.classList.add('selected');

            // Update color display
            const colorDisplay = document.getElementById(`${slotName.toLowerCase()}-color`);
            if (colorDisplay) {
                colorDisplay.textContent = colorName;
                colorDisplay.className = `slot-selected-color ${colorName.toLowerCase()}`;
            }
        }
    }

    incrementCounter(event) {
        const button = event.target.closest('.slot-counter-btn');
        if (!button) return;

        const slotName = button.dataset.slot;
        this.slotCounters[slotName]++;

        // Update display
        const counterValue = button.querySelector('.counter-value');
        if (counterValue) {
            counterValue.textContent = this.slotCounters[slotName];
        }
    }

    confirmPull() {
        // Check if all slots have colors selected
        const allSelected = Object.values(this.slotSelections).every(color => color !== null);

        if (!allSelected) {
            alert('Please select a color for all 5 slots!');
            return;
        }

        // Create pull record
        const pullRecord = {
            pullNumber: this.totalPulls + 1,
            timestamp: new Date().toISOString(),
            slotColors: { ...this.slotSelections },
            slotCounters: { ...this.slotCounters }
        };

        // Add to history
        this.pullHistory.push(pullRecord);

        // Update counters
        this.totalPulls++;
        this.sessionPulls++;

        // Apply counter reset logic
        for (const slotName in this.slotCounters) {
            const color = this.slotSelections[slotName];
            if (color === 'Gold') {
                this.slotCounters[slotName] = 0;
            }
        }

        // Save and update UI
        this.savePullHistory();
        this.clearSelections();
        this.renderHistory();
        this.updateUI();
    }

    clearSelections() {
        // Reset selections
        for (const slotName in this.slotSelections) {
            this.slotSelections[slotName] = null;
        }

        // Update UI
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        document.querySelectorAll('.slot-selected-color').forEach(el => {
            el.textContent = 'None';
            el.className = 'slot-selected-color';
        });

        // Note: Counters are NOT reset here, only on confirm
    }

    updateUI() {
        // Update statistics
        const avgPulls = this.sessionCount > 0 ? (this.totalPulls / this.sessionCount).toFixed(1) : 0;

        const totalPullsEl = document.getElementById('gacha-total-pulls');
        if (totalPullsEl) totalPullsEl.textContent = this.totalPulls;

        const sessionPullsEl = document.getElementById('gacha-session-pulls');
        if (sessionPullsEl) sessionPullsEl.textContent = this.sessionPulls;

        const sessionCountEl = document.getElementById('gacha-session-count');
        if (sessionCountEl) sessionCountEl.textContent = this.sessionCount;

        const avgPullsEl = document.getElementById('gacha-avg-pulls');
        if (avgPullsEl) avgPullsEl.textContent = avgPulls;
    }

    renderHistory() {
        const historyContainer = document.getElementById('gacha-history');
        if (!historyContainer) return;

        if (this.pullHistory.length === 0) {
            historyContainer.innerHTML = '<p class="empty-history">No pulls recorded yet</p>';
            return;
        }

        // Show last 20 pulls
        const recentPulls = this.pullHistory.slice(-20).reverse();

        historyContainer.innerHTML = recentPulls.map((record, index) => {
            const timestamp = new Date(record.timestamp).toLocaleString();
            const colors = Object.entries(record.slotColors)
                .map(([slot, color]) => `<span class="color-badge ${color.toLowerCase()}">${slot}: ${color}</span>`)
                .join('');

            return `
                <div class="history-item">
                    <div class="history-pull-num">Pull #${record.pullNumber}</div>
                    <div class="history-colors">${colors}</div>
                    <div class="history-timestamp">${timestamp}</div>
                </div>
            `;
        }).join('');
    }

    savePullHistory() {
        try {
            localStorage.setItem('gacha_pull_history', JSON.stringify(this.pullHistory));
        } catch (error) {
            console.error('Error saving pull history:', error);
        }
    }

    loadPullHistory() {
        try {
            const saved = localStorage.getItem('gacha_pull_history');
            if (saved) {
                this.pullHistory = JSON.parse(saved);

                // Calculate stats
                this.totalPulls = this.pullHistory.length;
                this.sessionCount = 1; // Start with 1 session
                this.sessionPulls = this.pullHistory.length; // Default to show all pulls as current session

                // Recalculate session count based on timestamps (new session if >1 hour gap)
                if (this.pullHistory.length > 0) {
                    this.sessionCount = 1;
                    let lastTimestamp = new Date(this.pullHistory[0].timestamp).getTime();

                    for (let i = 1; i < this.pullHistory.length; i++) {
                        const currentTimestamp = new Date(this.pullHistory[i].timestamp).getTime();
                        const timeDiff = currentTimestamp - lastTimestamp;

                        // If more than 1 hour since last pull, it's a new session
                        if (timeDiff > 3600000) {
                            // Don't count it as session change, but you could implement this logic
                        }

                        lastTimestamp = currentTimestamp;
                    }

                    // For now, assume current session contains all pulls
                    this.sessionPulls = this.pullHistory.length;
                }

                this.renderHistory();
            }
        } catch (error) {
            console.error('Error loading pull history:', error);
        }
    }

    exportHistory() {
        if (this.pullHistory.length === 0) {
            alert('No pull history to export!');
            return;
        }

        const data = JSON.stringify(this.pullHistory, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gacha_history_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importHistory(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result);

                if (!Array.isArray(data)) {
                    throw new Error('Invalid format');
                }

                // Confirm merge
                const shouldMerge = confirm(
                    `Import ${data.length} pulls? This will be merged with existing data.`
                );

                if (shouldMerge) {
                    this.pullHistory = [...this.pullHistory, ...data];
                    this.pullHistory.sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    // Recalculate stats
                    this.totalPulls = this.pullHistory.length;
                    this.sessionCount = 1;
                    this.sessionPulls = this.pullHistory.length;

                    this.savePullHistory();
                    this.renderHistory();
                    this.updateUI();

                    alert('Pull history imported successfully!');
                }
            } catch (error) {
                console.error('Error importing history:', error);
                alert('Failed to import file. Please ensure it\'s a valid JSON export.');
            }
        };

        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all pull history? This cannot be undone!')) {
            this.pullHistory = [];
            this.totalPulls = 0;
            this.sessionPulls = 0;
            this.sessionCount = 0;

            // Reset slot counters
            for (const slotName in this.slotCounters) {
                this.slotCounters[slotName] = 0;
            }

            this.savePullHistory();
            this.renderHistory();
            this.updateUI();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the gacha tab or when it becomes active
    window.gachaTracker = new GachaTracker();
});
