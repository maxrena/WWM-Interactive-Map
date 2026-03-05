(() => {
    const STORAGE_KEY = 'wwm-guild-war-data-v2';
    const OAUTH_STATE_KEY = 'wwm-gw-oauth-state';
    const OAUTH_TOKEN_KEY = 'wwm-gw-oauth-token';
    const OAUTH_USER_KEY = 'wwm-gw-oauth-user';

    const STATUS_CLASS = {
        success: 'success',
        error: 'error',
        loading: 'loading'
    };

    const defaultState = {
        oauthConfig: {
            clientId: '',
            redirectUri: ''
        },
        registrations: [],
        generated: {
            teams: [],
            reserve: [],
            config: null,
            generatedAt: null
        },
        attendanceEvents: [],
        webhookUrl: ''
    };

    let state = { ...defaultState };
    let elements = {};
    let currentDiscordUser = null;

    function readDeploymentConfig() {
        const cfg = (typeof window !== 'undefined' && window.GUILD_WAR_CONFIG && typeof window.GUILD_WAR_CONFIG === 'object')
            ? window.GUILD_WAR_CONFIG
            : {};

        return {
            clientId: typeof cfg.discordClientId === 'string' ? cfg.discordClientId.trim() : '',
            redirectUri: typeof cfg.discordRedirectUri === 'string' ? cfg.discordRedirectUri.trim() : '',
            appBaseUrl: typeof cfg.appBaseUrl === 'string' ? cfg.appBaseUrl.trim() : ''
        };
    }

    async function init() {
        if (!document.getElementById('tab-guild-war')) {
            return;
        }

        elements = {
            form: document.getElementById('gwRegistrationForm'),
            discordName: document.getElementById('gwDiscordName'),
            characterName: document.getElementById('gwCharacterName'),
            role: document.getElementById('gwRole'),
            powerLevel: document.getElementById('gwPowerLevel'),
            timeSlots: document.getElementById('gwTimeSlots'),
            isBackup: document.getElementById('gwIsBackup'),
            canSub: document.getElementById('gwCanSub'),
            submitRegistrationBtn: document.getElementById('gwSubmitRegistrationBtn'),
            memberStatus: document.getElementById('gwMemberStatus'),
            discordLoginBtn: document.getElementById('gwDiscordLoginBtn'),
            discordLogoutBtn: document.getElementById('gwDiscordLogoutBtn'),
            authIdentity: document.getElementById('gwAuthIdentity'),
            oauthClientId: document.getElementById('gwDiscordClientId'),
            oauthRedirectUri: document.getElementById('gwDiscordRedirectUri'),
            saveOauthConfigBtn: document.getElementById('gwSaveOauthConfigBtn'),
            importMapPlayersBtn: document.getElementById('gwImportMapPlayersBtn'),
            teamSize: document.getElementById('gwTeamSize'),
            tankPerTeam: document.getElementById('gwTankPerTeam'),
            healerPerTeam: document.getElementById('gwHealerPerTeam'),
            dpsPerTeam: document.getElementById('gwDpsPerTeam'),
            generateTeamsBtn: document.getElementById('gwGenerateTeamsBtn'),
            clearGeneratedBtn: document.getElementById('gwClearGeneratedBtn'),
            webhookUrl: document.getElementById('gwWebhookUrl'),
            postDiscordBtn: document.getElementById('gwPostDiscordBtn'),
            copyDiscordBtn: document.getElementById('gwCopyDiscordBtn'),
            actionStatus: document.getElementById('gwActionStatus'),
            clearRegistrationsBtn: document.getElementById('gwClearRegistrationsBtn'),
            registrantBody: document.getElementById('gwRegistrantBody'),
            teamsContainer: document.getElementById('gwTeamsContainer'),
            reserveList: document.getElementById('gwReserveList'),
            eventDate: document.getElementById('gwEventDate'),
            saveAttendanceBtn: document.getElementById('gwSaveAttendanceBtn'),
            attendanceBody: document.getElementById('gwAttendanceBody'),
            reliabilityBody: document.getElementById('gwReliabilityBody')
        };

        loadState();
        initializeDefaults();
        bindEvents();

        await processDiscordOAuthRedirect();
        restoreDiscordSession();
        updateAuthUi();
        renderAll();
    }

    function bindEvents() {
        elements.form?.addEventListener('submit', handleRegistrationSubmit);
        elements.discordLoginBtn?.addEventListener('click', startDiscordLogin);
        elements.discordLogoutBtn?.addEventListener('click', logoutDiscord);
        elements.saveOauthConfigBtn?.addEventListener('click', saveOauthConfig);
        elements.importMapPlayersBtn?.addEventListener('click', importFromMapPlayers);
        elements.generateTeamsBtn?.addEventListener('click', generateTeams);
        elements.clearGeneratedBtn?.addEventListener('click', clearGenerated);
        elements.postDiscordBtn?.addEventListener('click', postTeamsToDiscord);
        elements.copyDiscordBtn?.addEventListener('click', copyDiscordMessage);
        elements.clearRegistrationsBtn?.addEventListener('click', clearRegistrations);
        elements.registrantBody?.addEventListener('click', handleRegistrantTableClick);
        elements.saveAttendanceBtn?.addEventListener('click', saveAttendanceSnapshot);
        elements.eventDate?.addEventListener('change', renderAttendanceTable);
        elements.webhookUrl?.addEventListener('change', persistWebhookUrl);
    }

    function initializeDefaults() {
        const deploymentConfig = readDeploymentConfig();

        if (elements.eventDate && !elements.eventDate.value) {
            elements.eventDate.value = new Date().toISOString().slice(0, 10);
        }

        if (elements.webhookUrl && state.webhookUrl) {
            elements.webhookUrl.value = state.webhookUrl;
        }

        if (elements.oauthClientId) {
            elements.oauthClientId.value = deploymentConfig.clientId || state.oauthConfig.clientId || '';
        }

        if (elements.oauthRedirectUri) {
            elements.oauthRedirectUri.value = deploymentConfig.redirectUri || state.oauthConfig.redirectUri || (window.location.origin + window.location.pathname);
        }

        resetMemberForm();
    }

    function saveOauthConfig() {
        const clientId = elements.oauthClientId?.value.trim() || '';
        const redirectUri = elements.oauthRedirectUri?.value.trim() || '';

        if (!clientId || !redirectUri) {
            setAdminStatus('Client ID and Redirect URI are required.', STATUS_CLASS.error);
            return;
        }

        state.oauthConfig.clientId = clientId;
        state.oauthConfig.redirectUri = redirectUri;
        saveState();
        setAdminStatus('OAuth config saved.', STATUS_CLASS.success);
    }

    async function startDiscordLogin() {
        const deploymentConfig = readDeploymentConfig();
        const clientId = deploymentConfig.clientId || state.oauthConfig.clientId || elements.oauthClientId?.value.trim();
        const redirectUri = deploymentConfig.redirectUri || state.oauthConfig.redirectUri || elements.oauthRedirectUri?.value.trim() || (window.location.origin + window.location.pathname);

        if (!clientId || !redirectUri) {
            setMemberStatus('Discord OAuth is not configured yet. Ask admin to set Client ID and Redirect URI in Guild War Admin.', STATUS_CLASS.error);
            return;
        }

        const oauthState = createId();
        sessionStorage.setItem(OAUTH_STATE_KEY, oauthState);

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'token',
            scope: 'identify',
            state: oauthState,
            prompt: 'consent'
        });

        window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    async function processDiscordOAuthRedirect() {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        if (!hash) {
            return;
        }

        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const oauthError = hashParams.get('error');

        if (!accessToken && !oauthError) {
            return;
        }

        history.replaceState({}, document.title, window.location.pathname + window.location.search);

        if (oauthError) {
            setMemberStatus(`Discord login failed: ${oauthError}`, STATUS_CLASS.error);
            return;
        }

        const returnedState = hashParams.get('state') || '';
        const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY) || '';
        sessionStorage.removeItem(OAUTH_STATE_KEY);

        if (!expectedState || returnedState !== expectedState) {
            setMemberStatus('Discord login state validation failed.', STATUS_CLASS.error);
            return;
        }

        try {
            setMemberStatus('Loading Discord profile...', STATUS_CLASS.loading);
            const profile = await fetchDiscordUser(accessToken);
            currentDiscordUser = profile;
            sessionStorage.setItem(OAUTH_TOKEN_KEY, accessToken);
            localStorage.setItem(OAUTH_USER_KEY, JSON.stringify(profile));
            setMemberStatus(`Logged in as ${profile.displayName}.`, STATUS_CLASS.success);
        } catch (error) {
            clearDiscordSession();
            setMemberStatus(`Discord login failed: ${error.message}`, STATUS_CLASS.error);
        }
    }

    function restoreDiscordSession() {
        if (currentDiscordUser) {
            return;
        }

        const raw = localStorage.getItem(OAUTH_USER_KEY);
        if (!raw) {
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.id && parsed.displayName) {
                currentDiscordUser = parsed;
            }
        } catch (error) {
            clearDiscordSession();
        }
    }

    function logoutDiscord() {
        clearDiscordSession();
        updateAuthUi();
        setMemberStatus('Logged out.', STATUS_CLASS.success);
    }

    function clearDiscordSession() {
        currentDiscordUser = null;
        sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        localStorage.removeItem(OAUTH_USER_KEY);
    }

    async function fetchDiscordUser(accessToken) {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Discord API request failed (${response.status})`);
        }

        const user = await response.json();
        const displayName = user.global_name || user.username || 'Unknown';
        const tag = user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : '';

        return {
            id: user.id,
            username: user.username || displayName,
            displayName,
            tag,
            fullHandle: `${user.username || displayName}${tag}`
        };
    }

    function updateAuthUi() {
        const isLoggedIn = !!currentDiscordUser;

        if (elements.authIdentity) {
            elements.authIdentity.textContent = isLoggedIn
                ? `${currentDiscordUser.displayName} (${currentDiscordUser.fullHandle})`
                : 'Not signed in';
        }

        if (elements.discordName) {
            elements.discordName.value = isLoggedIn ? currentDiscordUser.fullHandle : '';
        }

        toggleMemberFormAccess(isLoggedIn);
    }

    function toggleMemberFormAccess(enabled) {
        if (!elements.form) {
            return;
        }

        const controls = elements.form.querySelectorAll('input, select, button');
        controls.forEach((control) => {
            if (control.id === 'gwDiscordName') {
                control.disabled = true;
                return;
            }
            control.disabled = !enabled;
        });

        if (!enabled) {
            resetMemberForm(false);
        }
    }

    function resetMemberForm(includeDiscord = true) {
        if (!elements.form) {
            return;
        }

        elements.form.reset();
        if (elements.powerLevel) {
            elements.powerLevel.value = 0;
        }

        if (includeDiscord && elements.discordName) {
            elements.discordName.value = currentDiscordUser ? currentDiscordUser.fullHandle : '';
        }
    }

    function handleRegistrationSubmit(event) {
        event.preventDefault();

        if (!currentDiscordUser) {
            setMemberStatus('Please login with Discord before submitting.', STATUS_CLASS.error);
            return;
        }

        const registration = readRegistrationForm();
        if (!registration) {
            return;
        }

        const duplicate = state.registrations.find((item) => getPlayerKey(item) === getPlayerKey(registration));
        if (duplicate) {
            setMemberStatus('You already registered this character with this Discord account.', STATUS_CLASS.error);
            return;
        }

        state.registrations.push(registration);
        saveState();
        resetMemberForm(true);
        setMemberStatus('Registration submitted.', STATUS_CLASS.success);
        renderAll();
    }

    function readRegistrationForm() {
        const characterName = elements.characterName?.value.trim() || '';
        const role = elements.role?.value || '';
        const powerLevel = Number.parseInt(elements.powerLevel?.value || '0', 10);
        const timeSlots = Array.from(elements.timeSlots?.querySelectorAll('input[type="checkbox"]:checked') || []).map((box) => box.value);

        if (!characterName || !role || Number.isNaN(powerLevel) || powerLevel < 0) {
            setMemberStatus('Please fill all required registration fields.', STATUS_CLASS.error);
            return null;
        }

        return {
            id: createId(),
            discordUserId: currentDiscordUser.id,
            discordName: currentDiscordUser.fullHandle,
            discordDisplayName: currentDiscordUser.displayName,
            characterName,
            role,
            powerLevel,
            timeSlots,
            isBackup: !!elements.isBackup?.checked,
            canSub: !!elements.canSub?.checked,
            createdAt: new Date().toISOString()
        };
    }

    function handleRegistrantTableClick(event) {
        const button = event.target.closest('button[data-action="delete"]');
        if (!button) {
            return;
        }

        const id = button.dataset.id;
        if (!id) {
            return;
        }

        state.registrations = state.registrations.filter((item) => item.id !== id);
        saveState();
        setAdminStatus('Registration removed.', STATUS_CLASS.success);
        renderAll();
    }

    function importFromMapPlayers() {
        if (typeof members === 'undefined' || !Array.isArray(members)) {
            setAdminStatus('Map player source is not available.', STATUS_CLASS.error);
            return;
        }

        let addedCount = 0;
        const existingKeys = new Set(state.registrations.map((item) => getPlayerKey(item)));

        members.forEach((member) => {
            const role = normalizeRole(member.role);
            const imported = {
                id: createId(),
                discordUserId: '',
                discordName: String(member.name || '').trim(),
                discordDisplayName: String(member.name || '').trim(),
                characterName: String(member.name || '').trim(),
                role,
                powerLevel: 0,
                timeSlots: [],
                isBackup: false,
                canSub: true,
                createdAt: new Date().toISOString()
            };

            if (!imported.discordName || !imported.characterName) {
                return;
            }

            const key = getPlayerKey(imported);
            if (existingKeys.has(key)) {
                return;
            }

            state.registrations.push(imported);
            existingKeys.add(key);
            addedCount += 1;
        });

        saveState();
        setAdminStatus(`Imported ${addedCount} player(s) from map roster.`, STATUS_CLASS.success);
        renderAll();
    }

    function clearRegistrations() {
        if (state.registrations.length === 0) {
            return;
        }

        if (!confirm('Clear all Guild War registrations?')) {
            return;
        }

        state.registrations = [];
        state.generated = {
            teams: [],
            reserve: [],
            config: null,
            generatedAt: null
        };

        saveState();
        setAdminStatus('All registrations cleared.', STATUS_CLASS.success);
        renderAll();
    }

    function clearGenerated() {
        state.generated = {
            teams: [],
            reserve: [],
            config: null,
            generatedAt: null
        };

        saveState();
        setAdminStatus('Generated teams cleared.', STATUS_CLASS.success);
        renderAll();
    }

    function generateTeams() {
        const config = getTeamConfig();
        if (!config) {
            return;
        }

        if (state.registrations.length === 0) {
            setAdminStatus('No registrations to generate teams from.', STATUS_CLASS.error);
            return;
        }

        if (config.tankPerTeam + config.healerPerTeam + config.dpsPerTeam > config.teamSize) {
            setAdminStatus('Role requirement exceeds team size.', STATUS_CLASS.error);
            return;
        }

        const reliabilityMap = buildReliabilityMap();
        const candidates = state.registrations.map((reg) => {
            const metrics = reliabilityMap[getPlayerKey(reg)] || getEmptyReliability();
            const reliability = metrics.registered > 0 ? metrics.showedUp / metrics.registered : 0;
            const priority = calculatePriority(reg.powerLevel, reliability, reg.isBackup);
            return { ...reg, reliability, priority };
        });

        const mains = candidates.filter((item) => !item.isBackup).sort(sortByPriority);
        const backups = candidates.filter((item) => item.isBackup).sort(sortByPriority);

        const poolByRole = {
            Tank: mains.filter((item) => item.role === 'Tank').concat(backups.filter((item) => item.role === 'Tank')),
            Healer: mains.filter((item) => item.role === 'Healer').concat(backups.filter((item) => item.role === 'Healer')),
            DPS: mains.filter((item) => item.role === 'DPS').concat(backups.filter((item) => item.role === 'DPS'))
        };

        const maxByRole = [
            getMaxByRole(poolByRole.Tank.length, config.tankPerTeam),
            getMaxByRole(poolByRole.Healer.length, config.healerPerTeam),
            getMaxByRole(poolByRole.DPS.length, config.dpsPerTeam)
        ];

        const maxByHeadcount = Math.floor(candidates.length / config.teamSize);
        const possibleTeamCount = Math.max(0, Math.min(maxByHeadcount, ...maxByRole));

        if (possibleTeamCount < 1) {
            state.generated = {
                teams: [],
                reserve: [...candidates].sort(sortByPriority),
                config,
                generatedAt: new Date().toISOString()
            };
            saveState();
            setAdminStatus('Not enough role coverage to build one full team with current rules.', STATUS_CLASS.error);
            renderAll();
            return;
        }

        const assigned = new Set();
        const teams = Array.from({ length: possibleTeamCount }, (_, index) => ({
            name: `Team ${index + 1}`,
            members: []
        }));

        teams.forEach((team) => {
            assignRoleToTeam(team, poolByRole.Tank, config.tankPerTeam, assigned);
            assignRoleToTeam(team, poolByRole.Healer, config.healerPerTeam, assigned);
            assignRoleToTeam(team, poolByRole.DPS, config.dpsPerTeam, assigned);
        });

        const remaining = candidates.filter((item) => !assigned.has(item.id)).sort(sortByPriority);

        teams.forEach((team) => {
            while (team.members.length < config.teamSize && remaining.length > 0) {
                const next = remaining.shift();
                if (!next) {
                    break;
                }
                team.members.push(next);
                assigned.add(next.id);
            }
            team.members.sort(sortByRoleThenPriority);
        });

        state.generated = {
            teams,
            reserve: candidates.filter((item) => !assigned.has(item.id)).sort(sortByPriority),
            config,
            generatedAt: new Date().toISOString()
        };

        saveState();
        setAdminStatus(`Generated ${teams.length} team(s).`, STATUS_CLASS.success);
        renderAll();
    }

    function assignRoleToTeam(team, pool, count, assignedSet) {
        if (count <= 0) {
            return;
        }

        let added = 0;
        for (let index = 0; index < pool.length; index += 1) {
            const candidate = pool[index];
            if (assignedSet.has(candidate.id)) {
                continue;
            }
            assignedSet.add(candidate.id);
            team.members.push(candidate);
            added += 1;
            if (added >= count) {
                return;
            }
        }
    }

    function buildDiscordMessage() {
        if (!state.generated.teams || state.generated.teams.length === 0) {
            return '';
        }

        const lines = ['⚔ Guild War Teams ⚔', ''];

        state.generated.teams.forEach((team) => {
            lines.push(team.name);
            team.members.forEach((member) => {
                const backupTag = member.isBackup ? ' (Backup)' : '';
                lines.push(`- [${member.role}] ${member.characterName} (${member.discordName}) Pwr:${member.powerLevel}${backupTag}`);
            });
            lines.push('');
        });

        if (state.generated.reserve && state.generated.reserve.length > 0) {
            lines.push('Reserve');
            state.generated.reserve.forEach((member) => {
                lines.push(`- [${member.role}] ${member.characterName} (${member.discordName})`);
            });
        }

        return lines.join('\n').trim();
    }

    async function copyDiscordMessage() {
        const message = buildDiscordMessage();
        if (!message) {
            setAdminStatus('Generate teams first to copy a Discord message.', STATUS_CLASS.error);
            return;
        }

        try {
            await navigator.clipboard.writeText(message);
            setAdminStatus('Discord message copied to clipboard.', STATUS_CLASS.success);
        } catch (error) {
            setAdminStatus('Clipboard copy failed in this environment.', STATUS_CLASS.error);
        }
    }

    async function postTeamsToDiscord() {
        const message = buildDiscordMessage();
        if (!message) {
            setAdminStatus('Generate teams first before posting.', STATUS_CLASS.error);
            return;
        }

        const webhookUrl = elements.webhookUrl?.value.trim() || '';
        if (!webhookUrl) {
            setAdminStatus('Webhook URL is required.', STATUS_CLASS.error);
            return;
        }

        state.webhookUrl = webhookUrl;
        saveState();

        setAdminStatus('Posting teams to Discord...', STATUS_CLASS.loading);

        try {
            const content = message.length > 1900 ? `${message.slice(0, 1870)}\n\n... (truncated)` : message;
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error(`Webhook request failed (${response.status})`);
            }

            setAdminStatus('Teams posted to Discord successfully.', STATUS_CLASS.success);
        } catch (error) {
            setAdminStatus(`Failed to post Discord message: ${error.message}`, STATUS_CLASS.error);
        }
    }

    function persistWebhookUrl() {
        state.webhookUrl = elements.webhookUrl?.value.trim() || '';
        saveState();
    }

    function saveAttendanceSnapshot() {
        const date = getSelectedEventDate();
        if (!date) {
            setAdminStatus('Please select an event date.', STATUS_CLASS.error);
            return;
        }

        const rows = Array.from(elements.attendanceBody?.querySelectorAll('tr') || []);
        if (rows.length === 0) {
            setAdminStatus('No registrations available for attendance.', STATUS_CLASS.error);
            return;
        }

        const records = rows.map((row) => {
            const statusSelect = row.querySelector('select');
            return {
                playerKey: row.dataset.playerKey,
                playerName: row.dataset.playerName,
                role: row.dataset.role,
                status: statusSelect ? statusSelect.value : 'showed-up'
            };
        });

        const existingIndex = state.attendanceEvents.findIndex((item) => item.date === date);
        const attendanceEvent = {
            date,
            records,
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            state.attendanceEvents[existingIndex] = attendanceEvent;
        } else {
            state.attendanceEvents.push(attendanceEvent);
        }

        state.attendanceEvents.sort((left, right) => left.date.localeCompare(right.date));

        saveState();
        setAdminStatus(`Attendance saved for ${date}.`, STATUS_CLASS.success);
        renderAll();
    }

    function renderAll() {
        renderRegistrantTable();
        renderGeneratedTeams();
        renderAttendanceTable();
        renderReliabilityTable();
    }

    function renderRegistrantTable() {
        if (!elements.registrantBody) {
            return;
        }

        const reliabilityMap = buildReliabilityMap();
        const sorted = [...state.registrations]
            .map((entry) => {
                const metrics = reliabilityMap[getPlayerKey(entry)] || getEmptyReliability();
                const reliability = metrics.registered > 0 ? metrics.showedUp / metrics.registered : 0;
                const priority = calculatePriority(entry.powerLevel, reliability, entry.isBackup);
                return { ...entry, reliability, priority };
            })
            .sort(sortByPriority);

        if (sorted.length === 0) {
            elements.registrantBody.innerHTML = '<tr><td colspan="9">No registrations yet.</td></tr>';
            return;
        }

        elements.registrantBody.innerHTML = sorted.map((entry) => {
            const flags = [entry.isBackup ? 'Backup' : 'Main', entry.canSub ? 'CanSub' : 'NoSub'].join(' / ');
            const slots = entry.timeSlots.length > 0 ? entry.timeSlots.join(', ') : '-';

            return `
                <tr>
                    <td>${escapeHtml(entry.discordName)}</td>
                    <td>${escapeHtml(entry.characterName)}</td>
                    <td>${escapeHtml(entry.role)}</td>
                    <td>${entry.powerLevel}</td>
                    <td>${formatPercent(entry.reliability)}</td>
                    <td>${entry.priority.toFixed(1)}</td>
                    <td>${escapeHtml(slots)}</td>
                    <td>${escapeHtml(flags)}</td>
                    <td>
                        <button type="button" class="btn-delete gw-delete-btn" data-action="delete" data-id="${entry.id}" title="Delete">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderGeneratedTeams() {
        if (!elements.teamsContainer || !elements.reserveList) {
            return;
        }

        if (!state.generated.teams || state.generated.teams.length === 0) {
            elements.teamsContainer.innerHTML = '<div class="gw-empty">No teams generated yet.</div>';
            elements.reserveList.innerHTML = '<li>-</li>';
            return;
        }

        const reliabilityMap = buildReliabilityMap();

        elements.teamsContainer.innerHTML = state.generated.teams.map((team) => {
            const memberItems = team.members.map((member) => {
                const metrics = reliabilityMap[getPlayerKey(member)] || getEmptyReliability();
                const reliability = metrics.registered > 0 ? metrics.showedUp / metrics.registered : 0;
                const backupTag = member.isBackup ? ' • Backup' : '';

                return `<li><strong>[${escapeHtml(member.role)}]</strong> ${escapeHtml(member.characterName)} <span>(${escapeHtml(member.discordName)})</span> • Pwr ${member.powerLevel} • ${formatPercent(reliability)}${backupTag}</li>`;
            }).join('');

            return `
                <article class="gw-team-card">
                    <h4>${escapeHtml(team.name)}</h4>
                    <ul>${memberItems || '<li>-</li>'}</ul>
                </article>
            `;
        }).join('');

        if (state.generated.reserve && state.generated.reserve.length > 0) {
            elements.reserveList.innerHTML = state.generated.reserve
                .map((member) => `<li><strong>[${escapeHtml(member.role)}]</strong> ${escapeHtml(member.characterName)} (${escapeHtml(member.discordName)})</li>`)
                .join('');
        } else {
            elements.reserveList.innerHTML = '<li>-</li>';
        }
    }

    function renderAttendanceTable() {
        if (!elements.attendanceBody) {
            return;
        }

        const selectedDate = getSelectedEventDate();
        const currentEvent = state.attendanceEvents.find((item) => item.date === selectedDate);
        const statusByPlayerKey = {};

        if (currentEvent && Array.isArray(currentEvent.records)) {
            currentEvent.records.forEach((record) => {
                statusByPlayerKey[record.playerKey] = record.status;
            });
        }

        if (state.registrations.length === 0) {
            elements.attendanceBody.innerHTML = '<tr><td colspan="3">No registrations available.</td></tr>';
            return;
        }

        elements.attendanceBody.innerHTML = state.registrations.map((entry) => {
            const key = getPlayerKey(entry);
            const selected = statusByPlayerKey[key] || 'showed-up';

            return `
                <tr data-player-key="${escapeHtml(key)}" data-player-name="${escapeHtml(entry.characterName)}" data-role="${escapeHtml(entry.role)}">
                    <td>${escapeHtml(entry.characterName)}</td>
                    <td>${escapeHtml(entry.role)}</td>
                    <td>
                        <select>
                            <option value="showed-up" ${selected === 'showed-up' ? 'selected' : ''}>Showed Up</option>
                            <option value="late" ${selected === 'late' ? 'selected' : ''}>Late</option>
                            <option value="no-show" ${selected === 'no-show' ? 'selected' : ''}>No Show</option>
                            <option value="excused" ${selected === 'excused' ? 'selected' : ''}>Excused</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderReliabilityTable() {
        if (!elements.reliabilityBody) {
            return;
        }

        const reliabilityMap = buildReliabilityMap();
        const entries = Object.values(reliabilityMap).sort((left, right) => {
            const leftRatio = left.registered > 0 ? left.showedUp / left.registered : 0;
            const rightRatio = right.registered > 0 ? right.showedUp / right.registered : 0;

            if (rightRatio !== leftRatio) {
                return rightRatio - leftRatio;
            }
            return right.registered - left.registered;
        });

        if (entries.length === 0) {
            elements.reliabilityBody.innerHTML = '<tr><td colspan="6">No attendance history yet.</td></tr>';
            return;
        }

        elements.reliabilityBody.innerHTML = entries.map((entry) => {
            const reliability = entry.registered > 0 ? entry.showedUp / entry.registered : 0;
            return `
                <tr>
                    <td>${escapeHtml(entry.playerName)}</td>
                    <td>${entry.registered}</td>
                    <td>${entry.showedUp}</td>
                    <td>${entry.late}</td>
                    <td>${entry.noShow}</td>
                    <td>${formatPercent(reliability)}</td>
                </tr>
            `;
        }).join('');
    }

    function buildReliabilityMap() {
        const map = {};

        state.attendanceEvents.forEach((event) => {
            if (!Array.isArray(event.records)) {
                return;
            }

            event.records.forEach((record) => {
                const key = record.playerKey;
                if (!key) {
                    return;
                }

                if (!map[key]) {
                    map[key] = {
                        playerKey: key,
                        playerName: record.playerName || key,
                        registered: 0,
                        showedUp: 0,
                        late: 0,
                        noShow: 0
                    };
                }

                map[key].registered += 1;
                if (record.status === 'showed-up') {
                    map[key].showedUp += 1;
                }
                if (record.status === 'late') {
                    map[key].showedUp += 1;
                    map[key].late += 1;
                }
                if (record.status === 'no-show') {
                    map[key].noShow += 1;
                }
            });
        });

        state.registrations.forEach((entry) => {
            const key = getPlayerKey(entry);
            if (!map[key]) {
                map[key] = {
                    playerKey: key,
                    playerName: entry.characterName,
                    ...getEmptyReliability()
                };
            }
        });

        return map;
    }

    function getEmptyReliability() {
        return {
            registered: 0,
            showedUp: 0,
            late: 0,
            noShow: 0
        };
    }

    function getTeamConfig() {
        const teamSize = Number.parseInt(elements.teamSize?.value || '0', 10);
        const tankPerTeam = Number.parseInt(elements.tankPerTeam?.value || '0', 10);
        const healerPerTeam = Number.parseInt(elements.healerPerTeam?.value || '0', 10);
        const dpsPerTeam = Number.parseInt(elements.dpsPerTeam?.value || '0', 10);

        if (
            Number.isNaN(teamSize) ||
            Number.isNaN(tankPerTeam) ||
            Number.isNaN(healerPerTeam) ||
            Number.isNaN(dpsPerTeam) ||
            teamSize < 1 ||
            tankPerTeam < 0 ||
            healerPerTeam < 0 ||
            dpsPerTeam < 0
        ) {
            setAdminStatus('Team config contains invalid values.', STATUS_CLASS.error);
            return null;
        }

        return {
            teamSize,
            tankPerTeam,
            healerPerTeam,
            dpsPerTeam
        };
    }

    function getMaxByRole(count, requiredPerTeam) {
        if (requiredPerTeam <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        return Math.floor(count / requiredPerTeam);
    }

    function getSelectedEventDate() {
        return elements.eventDate?.value || new Date().toISOString().slice(0, 10);
    }

    function calculatePriority(powerLevel, reliability, isBackup) {
        const backupPenalty = isBackup ? 5 : 0;
        return (powerLevel * 0.6) + (reliability * 100 * 0.4) - backupPenalty;
    }

    function sortByPriority(left, right) {
        if (right.priority !== left.priority) {
            return right.priority - left.priority;
        }
        if (left.isBackup !== right.isBackup) {
            return left.isBackup ? 1 : -1;
        }
        return right.powerLevel - left.powerLevel;
    }

    function sortByRoleThenPriority(left, right) {
        const roleOrder = { Tank: 1, Healer: 2, DPS: 3 };
        const leftOrder = roleOrder[left.role] || 9;
        const rightOrder = roleOrder[right.role] || 9;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return right.priority - left.priority;
    }

    function normalizeRole(roleValue) {
        if (roleValue === 'Tank' || roleValue === 'Healer' || roleValue === 'DPS') {
            return roleValue;
        }
        return 'DPS';
    }

    function getPlayerKey(player) {
        const userId = String(player.discordUserId || '').trim().toLowerCase();
        const discord = String(player.discordName || '').trim().toLowerCase();
        const character = String(player.characterName || '').trim().toLowerCase();

        if (userId) {
            return `${userId}|${character}`;
        }

        return `${discord}|${character}`;
    }

    function createId() {
        return `gw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function setAdminStatus(message, statusType) {
        setStatus(elements.actionStatus, message, statusType);
    }

    function setMemberStatus(message, statusType) {
        setStatus(elements.memberStatus, message, statusType);
    }

    function setStatus(targetElement, message, statusType) {
        if (!targetElement) {
            return;
        }

        targetElement.className = 'import-status';
        if (statusType && STATUS_CLASS[statusType]) {
            targetElement.classList.add(statusType);
        }
        targetElement.textContent = message;
    }

    function formatPercent(value) {
        return `${Math.round((value || 0) * 100)}%`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        const deploymentConfig = readDeploymentConfig();

        if (!raw) {
            state = { ...defaultState };
            state.oauthConfig.clientId = deploymentConfig.clientId || state.oauthConfig.clientId;
            state.oauthConfig.redirectUri = deploymentConfig.redirectUri || state.oauthConfig.redirectUri;
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            state = {
                oauthConfig: parsed.oauthConfig && typeof parsed.oauthConfig === 'object'
                    ? {
                        clientId: deploymentConfig.clientId || parsed.oauthConfig.clientId || '',
                        redirectUri: deploymentConfig.redirectUri || parsed.oauthConfig.redirectUri || ''
                    }
                    : { ...defaultState.oauthConfig },
                registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
                generated: parsed.generated && typeof parsed.generated === 'object'
                    ? {
                        teams: Array.isArray(parsed.generated.teams) ? parsed.generated.teams : [],
                        reserve: Array.isArray(parsed.generated.reserve) ? parsed.generated.reserve : [],
                        config: parsed.generated.config || null,
                        generatedAt: parsed.generated.generatedAt || null
                    }
                    : { ...defaultState.generated },
                attendanceEvents: Array.isArray(parsed.attendanceEvents) ? parsed.attendanceEvents : [],
                webhookUrl: typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl : ''
            };
        } catch (error) {
            state = { ...defaultState };
            state.oauthConfig.clientId = deploymentConfig.clientId || state.oauthConfig.clientId;
            state.oauthConfig.redirectUri = deploymentConfig.redirectUri || state.oauthConfig.redirectUri;
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
    });
})();
