package com.example.wopibackend.controller;

import com.example.wopibackend.model.DocumentInfo;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*", exposedHeaders = "*")
public class WopiController {

	@Value("${wopi.files.dir}")
	private String filesDir;

	@Value("${wopi.sample.path}")
	private String samplePath;

	private final Map<String, String> locks = new ConcurrentHashMap<>();

	private File resolveFile(String path) {
		File file = new File(path);
		if (file.exists()) {
			return file;
		}
		if (path.startsWith("wopi-backend/")) {
			File stripped = new File(path.substring("wopi-backend/".length()));
			if (stripped.exists()) {
				return stripped;
			}
		}
		File fallback = new File("wopi-backend/" + path);
		if (fallback.exists()) {
			return fallback;
		}
		return file;
	}

	private File getFilesDirectory() {
		File dir = resolveFile(filesDir);
		if (!dir.exists()) {
			dir.mkdirs();
		}
		return dir;
	}

	private File getSampleFile() {
		return resolveFile(samplePath);
	}

	private File getFilePath(String fileId) {
		String safeId = new File(fileId).getName();
		return new File(getFilesDirectory(), safeId + ".docx");
	}

	@PostConstruct
	public void initDefaultFiles() {
		File dir = getFilesDirectory();
		String[] files = dir.list();
		File sample = getSampleFile();
		if ((files == null || files.length == 0) && sample.exists()) {
			try {
				Files.copy(sample.toPath(), new File(dir, "getting_started.docx").toPath(), StandardCopyOption.REPLACE_EXISTING);
				Files.copy(sample.toPath(), new File(dir, "project_report.docx").toPath(), StandardCopyOption.REPLACE_EXISTING);
				System.out.println("Initialized default sample files in: " + dir.getAbsolutePath());
			} catch (IOException e) {
				System.err.println("Failed to initialize default files: " + e.getMessage());
			}
		}
	}

	// ==========================================
	// APPLICATION API ENDPOINTS (React Frontend)
	// ==========================================

	@GetMapping("/api/files")
	public ResponseEntity<?> getFiles() {
		try {
			File dir = getFilesDirectory();
			File[] files = dir.listFiles((d, name) -> name.endsWith(".docx"));
			List<DocumentInfo> documentList = new ArrayList<>();
			if (files != null) {
				for (File file : files) {
					String id = file.getName().substring(0, file.getName().length() - 5);
					documentList.add(new DocumentInfo(
							id,
							id.replace("_", " "),
							file.length(),
							Instant.ofEpochMilli(file.lastModified())
					));
				}
			}
			return ResponseEntity.ok(documentList);
		} catch (Exception e) {
			return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
		}
	}

	@PostMapping("/api/files")
	public ResponseEntity<?> createFile(@RequestBody Map<String, String> payload) {
		String name = payload.get("name");
		if (name == null || name.trim().isEmpty()) {
			return ResponseEntity.status(400).body(Map.of("error", "Document name is required"));
		}

		String safeName = name.trim().toLowerCase().replaceAll("[^a-z0-9]", "_");
		File file = getFilePath(safeName);

		if (file.exists()) {
			return ResponseEntity.status(400).body(Map.of("error", "A document with this name already exists"));
		}

		try {
			File sample = getSampleFile();
			if (sample.exists()) {
				Files.copy(sample.toPath(), file.toPath());
				System.out.println("[API] Created new document: " + safeName + ".docx");
				return ResponseEntity.status(201).body(new DocumentInfo(
						safeName,
						safeName.replace("_", " "),
						file.length(),
						Instant.ofEpochMilli(file.lastModified())
				));
			} else {
				return ResponseEntity.status(500).body(Map.of("error", "Sample docx template not found"));
			}
		} catch (Exception e) {
			return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
		}
	}

	@DeleteMapping("/api/files/{id}")
	public ResponseEntity<?> deleteFile(@PathVariable("id") String id) {
		File file = getFilePath(id);
		if (!file.exists()) {
			return ResponseEntity.status(404).body(Map.of("error", "Document not found"));
		}

		try {
			if (file.delete()) {
				locks.remove(id);
				System.out.println("[API] Deleted document: " + id + ".docx");
				return ResponseEntity.ok(Map.of("success", true));
			} else {
				return ResponseEntity.status(500).body(Map.of("error", "Failed to delete file"));
			}
		} catch (Exception e) {
			return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
		}
	}

	// ==========================================
	// WOPI CLIENT ENDPOINTS (Collabora Online)
	// ==========================================

	@GetMapping("/wopi/files/{fileId}")
	public ResponseEntity<?> checkFileInfo(@PathVariable("fileId") String fileId) {
		File file = getFilePath(fileId);
		if (!file.exists()) {
			return ResponseEntity.status(404).body(Map.of("error", "File not found"));
		}

		String fileName = fileId.endsWith(".docx") ? fileId : fileId + ".docx";

		Map<String, Object> fileInfo = new LinkedHashMap<>();
		fileInfo.put("BaseFileName", fileName);
		fileInfo.put("OwnerId", "admin");
		fileInfo.put("Size", file.length());
		fileInfo.put("UserId", "user_1");
		fileInfo.put("UserFriendlyName", "Developer User");
		fileInfo.put("Version", String.valueOf(file.lastModified()));

		fileInfo.put("SupportsLocks", true);
		fileInfo.put("SupportsUpdate", true);
		fileInfo.put("UserCanWrite", true);
		fileInfo.put("UserCanNotWriteRelative", false);

		fileInfo.put("PostMessageOrigin", "http://localhost:5173");
		fileInfo.put("HidePrintOption", false);
		fileInfo.put("HideSaveOption", false);
		fileInfo.put("HideExportOption", false);
		fileInfo.put("EnableOwnerStatus", true);

		System.out.println("[WOPI] CheckFileInfo called for " + fileId + " - returning size: " + file.length() + " bytes");
		return ResponseEntity.ok(fileInfo);
	}

	@GetMapping("/wopi/files/{fileId}/contents")
	public ResponseEntity<byte[]> getFile(@PathVariable("fileId") String fileId) {
		File file = getFilePath(fileId);
		if (!file.exists()) {
			return ResponseEntity.status(404).build();
		}

		try {
			byte[] content = Files.readAllBytes(file.toPath());
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
			headers.set("X-WOPI-ItemVersion", String.valueOf(file.lastModified()));
			headers.setContentDisposition(ContentDisposition.builder("attachment").filename(fileId + ".docx").build());

			System.out.println("[WOPI] GetFile called for " + fileId + " - serving binary contents");
			return new ResponseEntity<>(content, headers, HttpStatus.OK);
		} catch (IOException e) {
			return ResponseEntity.status(500).build();
		}
	}

	@PostMapping("/wopi/files/{fileId}/contents")
	public ResponseEntity<?> putFile(
			@PathVariable("fileId") String fileId,
			@RequestHeader(value = "X-WOPI-Lock", required = false) String incomingLock,
			@RequestBody byte[] body) {

		File file = getFilePath(fileId);
		if (!file.exists()) {
			return ResponseEntity.status(404).body("File not found");
		}

		String safeIncomingLock = incomingLock != null ? incomingLock : "";
		String currentLock = locks.getOrDefault(fileId, "");

		System.out.println("[WOPI] PutFile called for " + fileId + ". Lock in header: \"" + safeIncomingLock + "\", Current Lock: \"" + currentLock + "\"");

		if (!currentLock.isEmpty() && !safeIncomingLock.equals(currentLock)) {
			System.err.println("[WOPI] PutFile lock conflict: header lock \"" + safeIncomingLock + "\" != current lock \"" + currentLock + "\"");
			HttpHeaders headers = new HttpHeaders();
			headers.set("X-WOPI-Lock", currentLock);
			return new ResponseEntity<>(Map.of("message", "Lock mismatch"), headers, HttpStatus.CONFLICT);
		}

		try {
			Files.write(file.toPath(), body);
			long lastMod = file.lastModified();

			HttpHeaders headers = new HttpHeaders();
			headers.set("X-WOPI-ItemVersion", String.valueOf(lastMod));
			System.out.println("[WOPI] PutFile success. Saved " + body.length + " bytes to " + file.getPath());
			return new ResponseEntity<>(null, headers, HttpStatus.OK);
		} catch (IOException e) {
			System.err.println("[WOPI] PutFile failed to write: " + e.getMessage());
			return ResponseEntity.status(500).body("Error saving file");
		}
	}

	@PostMapping("/wopi/files/{fileId}")
	public ResponseEntity<?> lockOperations(
			@PathVariable("fileId") String fileId,
			@RequestHeader(value = "X-WOPI-Override", required = false) String overrideHeader,
			@RequestHeader(value = "X-WOPI-Lock", required = false) String incomingLock,
			@RequestHeader(value = "X-WOPI-OldLock", required = false) String oldLock) {

		File file = getFilePath(fileId);
		if (!file.exists()) {
			return ResponseEntity.status(404).body("File not found");
		}

		String safeOverrideHeader = overrideHeader != null ? overrideHeader : "";
		String safeIncomingLock = incomingLock != null ? incomingLock : "";
		String safeOldLock = oldLock != null ? oldLock : "";
		String currentLock = locks.getOrDefault(fileId, "");

		System.out.println("[WOPI] Lock Operation [" + safeOverrideHeader + "] for " + fileId +
				". Lock: \"" + safeIncomingLock + "\", OldLock: \"" + safeOldLock + "\", CurrentLock: \"" + currentLock + "\"");

		HttpHeaders responseHeaders = new HttpHeaders();
		responseHeaders.setContentType(MediaType.APPLICATION_JSON);

		switch (safeOverrideHeader) {
			case "LOCK":
				if (!safeOldLock.isEmpty()) {
					if (currentLock.equals(safeOldLock)) {
						locks.put(fileId, safeIncomingLock);
						System.out.println("[WOPI] Lock updated from \"" + safeOldLock + "\" to \"" + safeIncomingLock + "\"");
						return ResponseEntity.ok().build();
					} else {
						responseHeaders.set("X-WOPI-Lock", currentLock);
						return new ResponseEntity<>(Map.of("message", "Lock mismatch for relock"), responseHeaders, HttpStatus.CONFLICT);
					}
				} else {
					if (currentLock.isEmpty() || currentLock.equals(safeIncomingLock)) {
						locks.put(fileId, safeIncomingLock);
						System.out.println("[WOPI] Lock acquired: \"" + safeIncomingLock + "\"");
						return ResponseEntity.ok().build();
					} else {
						responseHeaders.set("X-WOPI-Lock", currentLock);
						return new ResponseEntity<>(Map.of("message", "File already locked"), responseHeaders, HttpStatus.CONFLICT);
					}
				}

			case "UNLOCK":
				if (currentLock.equals(safeIncomingLock)) {
					locks.remove(fileId);
					System.out.println("[WOPI] File unlocked");
					return ResponseEntity.ok().build();
				} else {
					responseHeaders.set("X-WOPI-Lock", currentLock);
					return new ResponseEntity<>(Map.of("message", "Lock mismatch for unlock"), responseHeaders, HttpStatus.CONFLICT);
				}

			case "REFRESH_LOCK":
				if (currentLock.equals(safeIncomingLock)) {
					System.out.println("[WOPI] Lock refreshed: \"" + safeIncomingLock + "\"");
					return ResponseEntity.ok().build();
				} else {
					responseHeaders.set("X-WOPI-Lock", currentLock);
					return new ResponseEntity<>(Map.of("message", "Lock mismatch for refresh"), responseHeaders, HttpStatus.CONFLICT);
				}

			case "GET_LOCK":
				responseHeaders.set("X-WOPI-Lock", currentLock);
				System.out.println("[WOPI] Get lock returned: \"" + currentLock + "\"");
				return new ResponseEntity<>(Map.of("lock", currentLock), responseHeaders, HttpStatus.OK);

			default:
				System.out.println("[WOPI] Unhandled lock operation override: " + safeOverrideHeader);
				return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body("Not implemented");
		}
	}
}
