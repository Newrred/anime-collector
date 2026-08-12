package com.newrred.moemoa;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import java.util.regex.Pattern;

final class ImageIntakeCoordinator {
    private static final Pattern SAFE_TICKET_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");

    private final File root;
    private final PendingIntakeStore store;
    private final ImageStager stager;
    private final PreviewGenerator previewGenerator;
    private final Supplier<String> ticketIdSupplier;
    private final LongSupplier clock;

    ImageIntakeCoordinator(
        File root,
        PendingIntakeStore store,
        ImageStager stager,
        PreviewGenerator previewGenerator,
        Supplier<String> ticketIdSupplier,
        LongSupplier clock
    ) {
        this.root = root;
        this.store = store;
        this.stager = stager;
        this.previewGenerator = previewGenerator;
        this.ticketIdSupplier = ticketIdSupplier;
        this.clock = clock;
    }

    PendingIntakeTicket capture(String mimeType, InputStream source) throws ImageIntakeException {
        String ticketId = ticketIdSupplier.get();

        try {
            StagedOriginal original = stager.stage(ticketId, mimeType, source);
            PreviewImage preview = previewGenerator.create(ticketId, original.getFileName());
            PendingIntakeTicket ticket = new PendingIntakeTicket(
                ticketId,
                original.getFileName(),
                preview.getFileName(),
                mimeType,
                original.getByteSize(),
                original.getChecksumSha256(),
                preview.getWidth(),
                preview.getHeight(),
                clock.getAsLong()
            );

            try {
                store.save(ticket);
            } catch (IOException exception) {
                throw new ImageIntakeException(
                    "TICKET_WRITE_FAILED",
                    "Unable to save pending image intake",
                    exception
                );
            }
            return ticket;
        } catch (ImageIntakeException exception) {
            cleanup(ticketId);
            throw exception;
        }
    }

    private void cleanup(String ticketId) {
        if (ticketId == null || !SAFE_TICKET_ID.matcher(ticketId).matches()) return;

        deleteQuietly(new File(root, ticketId + ".original"));
        deleteQuietly(new File(root, ticketId + ".original.part"));
        deleteQuietly(new File(root, ticketId + ".preview.jpg"));
        deleteQuietly(new File(root, ticketId + ".preview.jpg.part"));
        deleteQuietly(new File(root, ticketId + ".ticket"));
        deleteQuietly(new File(root, ticketId + ".tmp"));
    }

    private static void deleteQuietly(File file) {
        if (file.exists()) file.delete();
    }
}
