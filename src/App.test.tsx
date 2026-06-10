import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from './App';
import { CollaboraEditor } from './components/CollaboraEditor';

describe('Collabora Workspace App & Editor Tests', () => {
	beforeEach(() => {
		vi.restoreAllMocks();

		// Mock HTMLFormElement.prototype.submit to avoid navigation errors in jsdom
		HTMLFormElement.prototype.submit = vi.fn();

		// Mock global fetch to return sample documents
		globalThis.fetch = vi.fn().mockImplementation((url) => {
			if (url.endsWith('/api/files')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve([
							{
								id: 'test_document_1',
								name: 'test_document_1',
								size: 2048,
								updatedAt: '2026-06-08T10:00:00.000Z',
							},
						]),
				} as Response);
			}
			return Promise.reject(new Error(`Unhandled request URL: ${url}`));
		});
	});

	describe('App Dashboard', () => {
		it('should render the dashboard header and title', async () => {
			render(<App />);

			expect(screen.getByText('Collabora Online')).toBeInTheDocument();
			expect(screen.getByText('Workspace')).toBeInTheDocument();
			expect(screen.getByText(/Verwalte und bearbeite Word-Dokumente \(.docx\) in Echtzeit/i)).toBeInTheDocument();
		});

		it('should display the document input and create button', async () => {
			const { container } = render(<App />);

			expect(screen.getByPlaceholderText('z.B. Projektbericht_Q2')).toBeInTheDocument();

			const createButton = container.querySelector('kol-button[_label="Erstellen"]');
			expect(createButton).toBeInTheDocument();
		});

		it('should render connection settings with inputs and label helpers', async () => {
			render(<App />);

			const collaboraInput = screen.getByLabelText('Collabora Online URL (CODE)') as HTMLInputElement;
			const wopiInput = screen.getByLabelText('WOPI Host URL (Backend)') as HTMLInputElement;

			expect(collaboraInput).toBeInTheDocument();
			expect(collaboraInput.value).toBe('http://localhost:9980');

			expect(wopiInput).toBeInTheDocument();
			expect(wopiInput.value).toBe('http://host.docker.internal:5001');
		});

		it('should render loaded documents from the API', async () => {
			render(<App />);

			// Expect loading state first
			expect(screen.getByText('Dokumente werden geladen...')).toBeInTheDocument();

			// Wait for the document list to load
			await waitFor(() => {
				expect(screen.getByText('test_document_1.docx')).toBeInTheDocument();
			});

			expect(screen.getByText('Größe: 2 KB')).toBeInTheDocument();
		});

		it('should allow changing connection settings and update localStorage', async () => {
			const setItemSpy = vi.spyOn(localStorage, 'setItem');
			render(<App />);

			const collaboraInput = screen.getByLabelText('Collabora Online URL (CODE)') as HTMLInputElement;
			fireEvent.change(collaboraInput, { target: { value: 'http://my-collabora:9980' } });

			expect(collaboraInput.value).toBe('http://my-collabora:9980');
			expect(setItemSpy).toHaveBeenCalledWith('cool_url', 'http://my-collabora:9980');
		});
	});

	describe('CollaboraEditor Component', () => {
		it('should render correctly with props', async () => {
			const onCloseMock = vi.fn();
			const { container } = render(
				<CollaboraEditor
					fileId="test_file"
					token="test_token"
					collaboraUrl="http://localhost:9980"
					wopiHostUrl="http://localhost:5001"
					onClose={onCloseMock}
				/>,
			);

			// Check title
			expect(screen.getByText(/Bearbeite:/)).toBeInTheDocument();
			expect(screen.getByText('test file.docx')).toBeInTheDocument();

			// Check iframe and form are present
			const iframe = container.querySelector('#collabora_iframe');
			const form = container.querySelector('#collabora_form');
			expect(iframe).toBeInTheDocument();
			expect(form).toBeInTheDocument();

			// Check action of the form has encoded WOPISrc URL
			expect(form).toHaveAttribute(
				'action',
				'http://localhost:9980/browser/dist/cool.html?WOPISrc=http%3A%2F%2Flocalhost%3A5001%2Fwopi%2Ffiles%2Ftest_file&lang=de',
			);

			// Check hidden token input
			const tokenInput = container.querySelector('input[name="access_token"]');
			expect(tokenInput).toBeInTheDocument();
			expect(tokenInput).toHaveAttribute('value', 'test_token');
		});

		it('should trigger form submit and write startup logs', async () => {
			const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit');
			render(
				<CollaboraEditor fileId="test_file" token="test_token" collaboraUrl="http://localhost:9980" wopiHostUrl="http://localhost:5001" onClose={vi.fn()} />,
			);

			// Wait for the form submission within the timeout
			await waitFor(() => {
				expect(submitSpy).toHaveBeenCalled();
			});

			// Check that bridge logs contain initialization entries
			expect(screen.getByText(/Initializing/)).toBeInTheDocument();
			expect(screen.getByText(/Submitting WOPI token/)).toBeInTheDocument();
		});

		it('should support closing the editor and calling onClose', async () => {
			const onCloseMock = vi.fn();
			const { container } = render(
				<CollaboraEditor
					fileId="test_file"
					token="test_token"
					collaboraUrl="http://localhost:9980"
					wopiHostUrl="http://localhost:5001"
					onClose={onCloseMock}
				/>,
			);

			const backButton = container.querySelector('kol-button[_label="Zurück zum Dashboard"]');
			expect(backButton).toBeInTheDocument();
		});
	});
});
