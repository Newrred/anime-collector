package com.newrred.moemoa;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

final class LocalMediaAsset {
    private final String assetId;
    private final String localRef;
    private final String checksumSha256;
    private final String mimeType;
    private final long byteSize;
    private final int width;
    private final int height;

    LocalMediaAsset(
        String assetId,
        String checksumSha256,
        String mimeType,
        long byteSize,
        int width,
        int height
    ) {
        this.assetId = Objects.requireNonNull(assetId, "assetId");
        this.localRef = "asset:" + assetId;
        this.checksumSha256 = Objects.requireNonNull(checksumSha256, "checksumSha256");
        this.mimeType = Objects.requireNonNull(mimeType, "mimeType");
        this.byteSize = byteSize;
        this.width = width;
        this.height = height;
    }

    String getLocalRef() {
        return localRef;
    }

    String getChecksumSha256() {
        return checksumSha256;
    }

    Map<String, Object> toMap() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("localRef", localRef);
        value.put("checksumSha256", checksumSha256);
        value.put("mimeType", mimeType);
        value.put("byteSize", byteSize);
        value.put("width", width);
        value.put("height", height);
        value.put("localOnly", true);
        return Collections.unmodifiableMap(value);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof LocalMediaAsset)) return false;
        LocalMediaAsset that = (LocalMediaAsset) other;
        return byteSize == that.byteSize &&
            width == that.width &&
            height == that.height &&
            assetId.equals(that.assetId) &&
            localRef.equals(that.localRef) &&
            checksumSha256.equals(that.checksumSha256) &&
            mimeType.equals(that.mimeType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(assetId, localRef, checksumSha256, mimeType, byteSize, width, height);
    }
}
