package com.newrred.moemoa;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletionException;

@CapacitorPlugin(name = "ImageIntake")
public class ImageIntakePlugin extends Plugin {
    private ImageIntakeRuntime runtime;

    @Override
    public void load() {
        runtime = ImageIntakeRuntime.get(getContext());
    }

    @PluginMethod
    public void claimPendingIntake(PluginCall call) {
        runtime.execute(() -> {
            try {
                Optional<PublicIntakeTicket> ticket = runtime.claimPublicTicket();
                JSObject result = new JSObject();
                result.put("ticket", ticket.isPresent() ? toJsObject(ticket.get()) : null);
                result.put("processing", runtime.isProcessing());
                String errorCode = runtime.consumeLastErrorCode();
                if (errorCode != null) result.put("errorCode", errorCode);
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    @PluginMethod
    public void pickImage(PluginCall call) {
        Intent intent = new Intent(PhotoPickerIntentPolicy.actionForSdk(Build.VERSION.SDK_INT));
        intent.setType("image/*");
        if (Build.VERSION.SDK_INT < 33) intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call, intent, "handlePickedImage");
    }

    @ActivityCallback
    private void handlePickedImage(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        Uri uri = data == null ? null : data.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject result = new JSObject();
            result.put("ticket", null);
            result.put("cancelled", true);
            call.resolve(result);
            return;
        }

        runtime.capture(uri, data.getType()).whenComplete((ticket, throwable) -> {
            if (throwable != null) {
                rejectOnMain(call, intakeException(throwable));
                return;
            }
            try {
                JSObject result = new JSObject();
                result.put("ticket", toJsObject(runtime.toPublicTicket(ticket)));
                result.put("cancelled", false);
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    @PluginMethod
    public void discardIntake(PluginCall call) {
        String ticketId = call.getString("ticketId");
        if (ticketId == null || ticketId.isEmpty()) {
            call.reject("A ticket id is required", "INVALID_TICKET");
            return;
        }

        runtime.execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("removed", runtime.discard(ticketId));
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    @PluginMethod
    public void promoteIntake(PluginCall call) {
        String ticketId = call.getString("ticketId");
        String assetId = call.getString("assetId");
        String operationId = call.getString("operationId");
        if (ticketId == null || ticketId.isEmpty() || assetId == null || assetId.isEmpty()) {
            call.reject("Ticket and asset ids are required", "INVALID_MEDIA_PROMOTION");
            return;
        }
        if (operationId == null || operationId.isEmpty()) {
            call.reject("An operation id is required", "INVALID_MEDIA_PROMOTION");
            return;
        }

        runtime.execute(() -> {
            try {
                JSObject result = toJsObject(runtime.promote(ticketId, assetId).toMap());
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    @PluginMethod
    public void getAssetPreview(PluginCall call) {
        String localRef = call.getString("localRef");
        if (localRef == null || localRef.isEmpty()) {
            call.reject("A private media reference is required", "INVALID_LOCAL_REF");
            return;
        }
        runtime.execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("previewDataUrl", runtime.readAssetPreviewDataUrl(localRef));
                result.put("localOnly", true);
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    @PluginMethod
    public void deleteAsset(PluginCall call) {
        String localRef = call.getString("localRef");
        if (localRef == null || localRef.isEmpty()) {
            call.reject("A private media reference is required", "INVALID_LOCAL_REF");
            return;
        }
        runtime.execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("deleted", runtime.deleteAsset(localRef));
                resolveOnMain(call, result);
            } catch (ImageIntakeException exception) {
                rejectOnMain(call, exception);
            }
        });
    }

    private static JSObject toJsObject(PublicIntakeTicket ticket) {
        return toJsObject(ticket.toMap());
    }

    private static JSObject toJsObject(Map<String, Object> value) {
        JSObject result = new JSObject();
        for (Map.Entry<String, Object> entry : value.entrySet()) {
            result.put(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private void resolveOnMain(PluginCall call, JSObject result) {
        getActivity().runOnUiThread(() -> call.resolve(result));
    }

    private void rejectOnMain(PluginCall call, ImageIntakeException exception) {
        getActivity().runOnUiThread(() -> call.reject(exception.getMessage(), exception.getCode()));
    }

    private static ImageIntakeException intakeException(Throwable throwable) {
        Throwable current = throwable instanceof CompletionException && throwable.getCause() != null
            ? throwable.getCause()
            : throwable;
        if (current instanceof ImageIntakeException) return (ImageIntakeException) current;
        return new ImageIntakeException("IMAGE_INTAKE_FAILED", "Unable to import selected image", current);
    }
}
