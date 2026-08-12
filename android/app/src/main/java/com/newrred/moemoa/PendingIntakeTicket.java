package com.newrred.moemoa;

import java.util.Objects;

final class PendingIntakeTicket {
    private final String ticketId;
    private final String stagedFileName;
    private final String previewFileName;
    private final String mimeType;
    private final long byteSize;
    private final String checksumSha256;
    private final int width;
    private final int height;
    private final long createdAtEpochMs;

    PendingIntakeTicket(
        String ticketId,
        String stagedFileName,
        String previewFileName,
        String mimeType,
        long byteSize,
        String checksumSha256,
        int width,
        int height,
        long createdAtEpochMs
    ) {
        this.ticketId = Objects.requireNonNull(ticketId, "ticketId");
        this.stagedFileName = Objects.requireNonNull(stagedFileName, "stagedFileName");
        this.previewFileName = Objects.requireNonNull(previewFileName, "previewFileName");
        this.mimeType = Objects.requireNonNull(mimeType, "mimeType");
        this.byteSize = byteSize;
        this.checksumSha256 = Objects.requireNonNull(checksumSha256, "checksumSha256");
        this.width = width;
        this.height = height;
        this.createdAtEpochMs = createdAtEpochMs;
    }

    String getTicketId() {
        return ticketId;
    }

    String getStagedFileName() {
        return stagedFileName;
    }

    String getPreviewFileName() {
        return previewFileName;
    }

    String getMimeType() {
        return mimeType;
    }

    long getByteSize() {
        return byteSize;
    }

    String getChecksumSha256() {
        return checksumSha256;
    }

    int getWidth() {
        return width;
    }

    int getHeight() {
        return height;
    }

    long getCreatedAtEpochMs() {
        return createdAtEpochMs;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof PendingIntakeTicket)) return false;
        PendingIntakeTicket that = (PendingIntakeTicket) other;
        return (
            byteSize == that.byteSize &&
            width == that.width &&
            height == that.height &&
            createdAtEpochMs == that.createdAtEpochMs &&
            ticketId.equals(that.ticketId) &&
            stagedFileName.equals(that.stagedFileName) &&
            previewFileName.equals(that.previewFileName) &&
            mimeType.equals(that.mimeType) &&
            checksumSha256.equals(that.checksumSha256)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
            ticketId,
            stagedFileName,
            previewFileName,
            mimeType,
            byteSize,
            checksumSha256,
            width,
            height,
            createdAtEpochMs
        );
    }
}
