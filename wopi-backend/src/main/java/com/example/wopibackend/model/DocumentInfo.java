package com.example.wopibackend.model;

import java.time.Instant;

public record DocumentInfo(
	String id,
	String name,
	long size,
	Instant updatedAt
) {}
