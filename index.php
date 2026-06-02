<?php

if (isset($_POST['ajax'])) {
$to = $_POST['to'];
$subject = $_POST['sub'];
$msg = $_POST['msg'];
$headers = "MIME-Version: 1.0" . "\r\n";
$headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
$headers .= "From: ".$_POST['name']."<".$_POST['from'].">";

$send = mail($to,$subject,$msg,$headers);

if ($send) {
	echo "<p id='success'>✔️  $to</p>";
}else{
	echo "<p id='error'>❌  $to</p>";
}
exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>NexusMail | Professional Email Dispatcher</title>
    <!-- Modern Font & Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0A0F1E 0%, #0B1120 100%);
            min-height: 100vh;
            color: #E2E8F0;
            padding: 1.5rem;
            position: relative;
        }

        /* Animated background gradient orbs */
        body::before {
            content: '';
            position: fixed;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0) 70%);
            top: -100px;
            right: -100px;
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
        }

        body::after {
            content: '';
            position: fixed;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0) 70%);
            bottom: -150px;
            left: -150px;
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
        }

        .glass-container {
            max-width: 1280px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }

        /* Header / Hero Section */
        .brand-header {
            text-align: center;
            margin-bottom: 2.5rem;
            animation: fadeInDown 0.6s ease-out;
        }

        .logo-badge {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            padding: 0.6rem 1.5rem;
            border-radius: 100px;
            border: 1px solid rgba(56, 189, 248, 0.25);
            margin-bottom: 1.5rem;
        }

        .logo-badge i {
            font-size: 1.8rem;
            color: #38BDF8;
            text-shadow: 0 0 6px #38BDF8;
        }

        .logo-badge span {
            font-weight: 700;
            font-size: 1.2rem;
            background: linear-gradient(135deg, #FFFFFF 0%, #94A3B8 100%);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            letter-spacing: -0.3px;
        }

        h1 {
            font-size: clamp(1.8rem, 6vw, 2.8rem);
            font-weight: 700;
            background: linear-gradient(135deg, #F1F5F9 0%, #CBD5E1 100%);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            letter-spacing: -0.02em;
            margin-bottom: 0.5rem;
        }

        .subhead {
            color: #94A3B8;
            font-size: 0.95rem;
            font-weight: 400;
            max-width: 500px;
            margin: 0 auto;
        }

        /* Main Card */
        .main-card {
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(16px);
            border-radius: 2rem;
            border: 1px solid rgba(56, 189, 248, 0.2);
            box-shadow: 0 25px 45px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.05) inset;
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.3s ease;
        }

        .form-panel {
            padding: 1.8rem 2rem 2rem;
        }

        /* Compact grid for inputs */
        .input-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1.2rem;
        }

        .full-width {
            grid-column: span 2;
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .input-group label {
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94A3B8;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .input-group label i {
            font-size: 0.75rem;
            color: #38BDF8;
        }

        input, textarea {
            background: #0F172A;
            border: 1px solid #1E293B;
            border-radius: 1rem;
            padding: 0.85rem 1rem;
            font-family: 'Inter', monospace;
            font-size: 0.9rem;
            color: #F1F5F9;
            transition: all 0.2s ease;
            outline: none;
            width: 100%;
            resize: vertical;
        }

        textarea {
            min-height: 110px;
            resize: vertical;
        }

        input:focus, textarea:focus {
            border-color: #38BDF8;
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
            background: #0B1120;
        }

        input::placeholder, textarea::placeholder {
            color: #475569;
            font-weight: 400;
            font-size: 0.85rem;
        }

        .double-textarea {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin: 1.2rem 0;
        }

        /* Button modern */
        .send-btn {
            width: 100%;
            background: linear-gradient(105deg, #0F172A 0%, #111827 100%);
            border: 1px solid rgba(56, 189, 248, 0.4);
            border-radius: 1.5rem;
            padding: 1rem;
            font-weight: 600;
            font-size: 1rem;
            color: #38BDF8;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
            backdrop-filter: blur(4px);
            margin-top: 0.75rem;
            letter-spacing: 0.3px;
        }

        .send-btn i {
            font-size: 1.1rem;
            transition: transform 0.2s;
        }

        .send-btn:hover {
            background: linear-gradient(105deg, #1E293B 0%, #0F172A 100%);
            border-color: #38BDF8;
            color: #7DD3FC;
            box-shadow: 0 10px 20px -10px rgba(56, 189, 248, 0.3);
            transform: translateY(-1px);
        }

        .send-btn:active {
            transform: translateY(2px);
        }

        /* results area - modern logs */
        .result-area {
            margin-top: 1.5rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 1.25rem;
            padding: 0.8rem 1rem;
            max-height: 280px;
            overflow-y: auto;
            font-size: 0.8rem;
            font-family: 'Inter', monospace;
            border: 1px solid rgba(56, 189, 248, 0.1);
        }

        .result-area::-webkit-scrollbar {
            width: 5px;
        }
        .result-area::-webkit-scrollbar-track {
            background: #0F172A;
            border-radius: 10px;
        }
        .result-area::-webkit-scrollbar-thumb {
            background: #38BDF8;
            border-radius: 10px;
        }

        .log-entry {
            padding: 0.6rem 0.8rem;
            margin-bottom: 0.5rem;
            border-radius: 0.9rem;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(2px);
            border-left: 3px solid;
            animation: slideIn 0.2s ease;
            font-size: 0.8rem;
            word-break: break-all;
        }

        .log-success {
            border-left-color: #10B981;
            color: #A7F3D0;
            background: rgba(16, 185, 129, 0.08);
        }

        .log-error {
            border-left-color: #EF4444;
            color: #FECACA;
            background: rgba(239, 68, 68, 0.05);
        }

        .log-info {
            border-left-color: #38BDF8;
            color: #BAE6FD;
        }

        /* status badge */
        .badge-status {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .clear-logs {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 0.5rem;
        }

        .clear-btn {
            background: none;
            border: none;
            color: #64748B;
            font-size: 0.7rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: color 0.2s;
        }

        .clear-btn:hover {
            color: #F87171;
        }

        /* Mobile adjustments */
        @media (max-width: 680px) {
            body {
                padding: 0.8rem;
            }
            .form-panel {
                padding: 1.2rem;
            }
            .double-textarea {
                grid-template-columns: 1fr;
                gap: 0.8rem;
            }
            .input-grid {
                grid-template-columns: 1fr;
                gap: 0.8rem;
            }
            .full-width {
                grid-column: span 1;
            }
            .brand-header {
                margin-bottom: 1.5rem;
            }
            .logo-badge {
                padding: 0.4rem 1rem;
            }
            input, textarea {
                padding: 0.7rem 0.9rem;
            }
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-15px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(8px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        /* loading spinner */
        .btn-loading {
            opacity: 0.7;
            pointer-events: none;
        }
        .btn-loading i {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        footer {
            text-align: center;
            margin-top: 2rem;
            font-size: 0.7rem;
            color: #475569;
        }
    </style>
</head>
<body>
<div class="glass-container">
    <div class="brand-header">
        <div class="logo-badge">
            <i class="fas fa-envelope-open-text"></i>
            <span>EmailSpoofer</span>
        </div>
        <h1>Precision Dispatch</h1>
        <div class="subhead">Professional email relay • Multi-recipient • Real-time logs</div>
    </div>

    <div class="main-card">
        <div class="form-panel">
            <form id="emailForm" action="" method="post">
                <div class="input-grid">
                    <div class="input-group">
                        <label><i class="fas fa-paper-plane"></i> FROM ADDRESS</label>
                        <input type="text" name="from" id="from" placeholder="sender@example.com" autocomplete="off">
                    </div>
                    <div class="input-group">
                        <label><i class="fas fa-user-tag"></i> DISPLAY NAME</label>
                        <input type="text" name="name" id="name" placeholder="Your Name / Brand" autocomplete="off">
                    </div>
                    <div class="input-group full-width">
                        <label><i class="fas fa-heading"></i> SUBJECT LINE</label>
                        <input type="text" name="sub" id="sub" placeholder="Important: Your subject here">
                    </div>
                </div>

                <div class="double-textarea">
                    <div class="input-group">
                        <label><i class="fas fa-code"></i> MESSAGE (HTML / TEXT)</label>
                        <textarea name="msg" id="msg" placeholder="HTML or plain text... &#10;&lt;strong&gt;Hello&lt;/strong&gt; world!"></textarea>
                    </div>
                    <div class="input-group">
                        <label><i class="fas fa-list-ul"></i> RECIPIENT LIST</label>
                        <textarea name="to" id="to" placeholder="one@example.com&#10;two@example.com&#10;three@domain.com"></textarea>
                        <small style="font-size: 0.65rem; color: #5B6E8C;">one email per line</small>
                    </div>
                </div>

                <button type="button" id="sendBtn" class="send-btn">
                    <i class="fas fa-bolt"></i> DISPATCH MESSAGES
                    <i class="fas fa-arrow-right"></i>
                </button>
            </form>

            <div class="clear-logs">
                <button id="clearLogsBtn" class="clear-btn"><i class="fas fa-trash-alt"></i> Clear logs</button>
            </div>
            <div id="resultContainer" class="result-area">
                <div class="log-entry log-info">
                    <i class="fas fa-info-circle" style="font-size:0.7rem;"></i> Ready — paste recipients, each on new line
                </div>
            </div>
        </div>
    </div>
    <footer>
        <i class="fas fa-shield-alt"></i> Encrypted transmission simulation • Professional relay interface
    </footer>
</div>

<script src="https://code.jquery.com/jquery-3.6.0.min.js" integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=" crossorigin="anonymous"></script>
<script>
$(document).ready(function(){
    let isSending = false;
    let pendingRequests = 0;

    // Helper: add log message
    function addLog(message, type = 'info') {
        const resultDiv = $('#resultContainer');
        let icon = '<i class="fas fa-envelope"></i>';
        let className = 'log-info';
        if (type === 'success') {
            icon = '<i class="fas fa-check-circle"></i>';
            className = 'log-success';
        } else if (type === 'error') {
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            className = 'log-error';
        }
        const logHtml = `<div class="log-entry ${className}">${icon} ${message}</div>`;
        resultDiv.append(logHtml);
        // auto-scroll to bottom
        resultDiv.scrollTop(resultDiv[0].scrollHeight);
    }

    // clear logs
    $('#clearLogsBtn').on('click', function(){
        $('#resultContainer').html('<div class="log-entry log-info"><i class="fas fa-info-circle"></i> Logs cleared — ready for new dispatch</div>');
    });

    // helper to reset button state
    function resetButton() {
        isSending = false;
        const btn = $('#sendBtn');
        btn.removeClass('btn-loading');
        btn.html('<i class="fas fa-bolt"></i> DISPATCH MESSAGES <i class="fas fa-arrow-right"></i>');
        btn.prop('disabled', false);
    }

    function setLoading() {
        const btn = $('#sendBtn');
        btn.addClass('btn-loading');
        btn.html('<i class="fas fa-spinner"></i> SENDING... <i class="fas fa-hourglass-half"></i>');
        btn.prop('disabled', true);
    }

    // main send logic with queue awareness (respect order and avoid overlapping)
    function processMailList() {
        if (isSending) return; // already processing

        const mailistRaw = $("#to").val();
        if (!mailistRaw.trim()) {
            addLog("❌ No recipients provided. Please enter at least one email address.", "error");
            return;
        }
        const mailist = mailistRaw.split(/\r?\n/).filter(email => email.trim().length > 0);
        if (mailist.length === 0) {
            addLog("❌ Recipient list is empty after filtering.", "error");
            return;
        }

        const fromVal = $("#from").val().trim();
        const nameVal = $("#name").val().trim();
        const subVal = $("#sub").val().trim();
        const msgVal = $("#msg").val();

        if (!fromVal) {
            addLog("⚠️ 'From Email' is required to spoof sender.", "error");
            return;
        }
        if (!subVal) {
            addLog("⚠️ Subject line is empty, but proceeding.", "info");
        }

        isSending = true;
        setLoading();

        let completed = 0;
        let errorsCount = 0;
        const total = mailist.length;

        addLog(`🚀 Starting dispatch to ${total} recipient(s)...`, "info");

        // store original values to avoid clearing before all requests done (clear only after full finish)
        // we will store the list and values, but we will only clear after all ajax calls are finished.

        for (let i = 0; i < total; i++) {
            const toEmail = mailist[i].trim();
            if (!toEmail) {
                completed++;
                continue;
            }
            // prepare data
            const data = {
                ajax: '1',
                from: fromVal,
                name: nameVal,
                sub: subVal,
                msg: msgVal,
                to: toEmail
            };

            $.ajax({
                type: 'POST',
                data: data,
                timeout: 15000,
                success: function(response) {
                    // response contains <p id='success'> or <p id='error'> from PHP logic
                    let statusType = 'success';
                    let responseMsg = '';
                    if (response.indexOf('id="success"') !== -1) {
                        responseMsg = $(response).text().trim();
                        addLog(`✔️ Delivered to ${responseMsg || toEmail}`, "success");
                    } else if (response.indexOf('id="error"') !== -1) {
                        responseMsg = $(response).text().trim();
                        addLog(`❌ Failed to ${responseMsg || toEmail}`, "error");
                        errorsCount++;
                    } else {
                        // fallback
                        addLog(`📬 Response from server for ${toEmail}`, "info");
                    }
                },
                error: function(xhr, status, err) {
                    addLog(`⚠️ Network error for ${toEmail}: ${status}`, "error");
                    errorsCount++;
                },
                complete: function() {
                    completed++;
                    if (completed === total) {
                        // all done
                        const successCount = total - errorsCount;
                        addLog(`✨ Batch complete — ${successCount} succeeded, ${errorsCount} failed.`, successCount === total ? "success" : "info");
                        // Clear form fields only if there were no errors? but safer to clear on completion (standard UX)
                        // Original script cleared all fields after each single mail? but now we clear only after full batch.
                        if (successCount > 0 || errorsCount === 0) {
                            // optional: clear fields only after full process (makes sense)
                            $("#from").val("");
                            $("#name").val("");
                            $("#sub").val("");
                            $("#msg").val("");
                            $("#to").val("");
                            addLog("🧹 Form fields cleared for next session.", "info");
                        } else {
                            addLog("📌 Fields were not auto-cleared due to errors — check your inputs.", "info");
                        }
                        resetButton();
                        isSending = false;
                    }
                }
            });
        }
        // edge case: if total=0 (should not happen), but handle
        if (total === 0) {
            addLog("No valid recipients found.", "error");
            resetButton();
            isSending = false;
        }
    }

    // Attach click event with double-tap prevention
    $("#sendBtn").on('click', function(e){
        e.preventDefault();
        if (isSending) {
            addLog("⚠️ Dispatch already in progress. Please wait.", "info");
            return;
        }
        processMailList();
    });

    // Also allow keyboard shortcuts? not needed, but professional touches
    // small live validation hint: ensure from field has '@'
    $("#from").on('blur', function(){
        let val = $(this).val();
        if (val && !val.includes('@')) {
            addLog("💡 From address should contain '@' for valid email format.", "info");
        }
    });

    // initially reset any floating state
});
</script>
</body>
</html>