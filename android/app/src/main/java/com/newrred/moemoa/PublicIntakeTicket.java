package com.newrred.moemoa;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

final class PublicIntakeTicket {
    private final Map<String, Object> value;

    private PublicIntakeTicket(Map<String, Object> value) {
        this.value = Collections.unmodifiableMap(value);
    }

    static PublicIntakeTicket from(PendingIntakeTicket ticket, String previewDataUrl) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("ticketId", ticket.getTicketId());
        value.put("mimeType", ticket.getMimeType());
        value.put("byteSize", ticket.getByteSize());
        value.put("width", ticket.getWidth());
        value.put("height", ticket.getHeight());
        value.put("createdAtEpochMs", ticket.getCreatedAtEpochMs());
        value.put("previewDataUrl", previewDataUrl);
        value.put("localOnly", true);
        return new PublicIntakeTicket(value);
    }

    Map<String, Object> toMap() {
        return value;
    }
}
