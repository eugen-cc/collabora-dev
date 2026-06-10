import { useEffect, useRef, useState } from 'react';
import { KolButton } from '@public-ui/react';

interface CollaboraEditorProps {
	fileId: string;
	token: string;
	collaboraUrl: string;
	wopiHostUrl: string;
	onClose: () => void;
}

export function CollaboraEditor({ fileId, token, collaboraUrl, wopiHostUrl, onClose }: CollaboraEditorProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const [logs, setLogs] = useState<string[]>([]);

	// Construct the WOPISrc URL that Collabora server will call
	// If wopiHostUrl is e.g. 'http://host.docker.internal:5001', the source is 'http://host.docker.internal:5001/wopi/files/getting_started'
	const wopiSrc = `${wopiHostUrl}/wopi/files/${fileId}`;

	// URL-encode WOPISrc for the action endpoint
	const actionUrl = `${collaboraUrl}/browser/dist/cool.html?WOPISrc=${encodeURIComponent(wopiSrc)}&lang=de`;

	useEffect(() => {
		// Log integration startup
		addLog(`Initializing WOPI hand-shake...`);
		addLog(`Collabora URL: ${collaboraUrl}`);
		addLog(`WOPISrc (Host): ${wopiSrc}`);
		addLog(`Action URL: ${actionUrl}`);

		// Short timeout to ensure iframe and form are fully mounted in DOM
		const timer = setTimeout(() => {
			if (formRef.current) {
				addLog('Submitting WOPI token authentication form...');
				formRef.current.submit();
			}
		}, 100);

		// Listen for postMessage notifications from the Collabora Online iframe
		const handleMessage = (event: MessageEvent) => {
			// Check if message is from Collabora
			if (!event.origin.startsWith(collaboraUrl)) {
				return;
			}

			try {
				let msgData = event.data;
				if (typeof msgData === 'string') {
					try {
						msgData = JSON.parse(msgData);
					} catch {
						// Not a JSON string
					}
				}

				if (msgData && msgData.MessageId) {
					addLog(`[PostMessage] Received event: ${msgData.MessageId}`);

					// Handle Close event from editor
					if (msgData.MessageId === 'close' || msgData.MessageId === 'UI_Close') {
						addLog('Editor close request received.');
						setTimeout(onClose, 800);
					}
				} else if (typeof event.data === 'string') {
					addLog(`[PostMessage Raw] ${event.data.substring(0, 100)}`);
				}
			} catch (err) {
				console.error('Error handling postMessage:', err);
			}
		};

		window.addEventListener('message', handleMessage);

		return () => {
			clearTimeout(timer);
			window.removeEventListener('message', handleMessage);
		};
	}, [fileId, collaboraUrl, wopiSrc, actionUrl, onClose]);

	function addLog(text: string) {
		const timestamp = new Date().toLocaleTimeString();
		setLogs((prev) => [`[${timestamp}] ${text}`, ...prev.slice(0, 19)]);
	}

	return (
		<div className="flex flex-col h-full bg-[#18181b] text-gray-200">
			{/* Top Control Bar */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-[#09090b]">
				<div className="flex items-center gap-4">
					<KolButton
						_label="Zurück zum Dashboard"
						_variant="secondary"
						_icons="codicon codicon-arrow-left"
						_on={{
							onClick: onClose,
						}}
					/>
					<div>
						<h2 className="text-lg font-bold text-white leading-none">
							Bearbeite: <span className="text-emerald-400">{fileId.replace(/_/g, ' ')}.docx</span>
						</h2>
						<p className="text-xs text-gray-400 mt-1">Kollaborativer Editor via WOPI</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className="flex h-2.5 w-2.5 relative">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
					</span>
					<span className="text-xs text-emerald-400 font-medium">Mit Collabora verbunden</span>
				</div>
			</div>

			{/* Main Editor Section */}
			<div className="flex flex-1 h-full min-h-0">
				{/* The IFrame Editor */}
				<div className="flex-1 relative bg-white">
					<iframe
						ref={iframeRef}
						id="collabora_iframe"
						name="collabora_iframe"
						className="absolute inset-0 w-full h-full border-none"
						title="Collabora Online Editor"
						allowFullScreen
						allow="clipboard-read; clipboard-write; autoplay; camera; microphone"
					/>

					{/* Hidden Form for Secure WOPI Token Passing */}
					<form ref={formRef} id="collabora_form" method="POST" action={actionUrl} target="collabora_iframe" className="hidden">
						<input type="hidden" name="access_token" value={token} />
					</form>
				</div>

				{/* Sidebar Console Logger (Developer Mode) */}
				<div className="w-80 border-l border-[#27272a] bg-[#121214] flex flex-col p-4">
					<div className="flex items-center justify-between pb-3 border-b border-[#27272a] mb-3">
						<h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">WOPI Bridge Console</h3>
						<KolButton
							_label="Logs leeren"
							_variant="ghost"
							_on={{
								onClick: () => setLogs([]),
							}}
						/>
					</div>

					<div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 pr-1 select-text scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
						{logs.length === 0 ? (
							<div className="text-gray-600 italic text-center pt-8">Keine Events aufgezeichnet</div>
						) : (
							logs.map((log, index) => (
								<div
									key={index}
									className={`p-1.5 rounded break-all ${
										log.includes('[PostMessage]')
											? 'bg-zinc-800/60 text-emerald-300'
											: log.includes('error') || log.includes('failed')
												? 'bg-red-950/40 text-red-400 border border-red-900/30'
												: 'text-zinc-400'
									}`}
								>
									{log}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
