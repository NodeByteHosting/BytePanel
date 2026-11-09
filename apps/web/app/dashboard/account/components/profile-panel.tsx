"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

interface Props {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
    hasImage: boolean;
  };
}

const getInitials = (name: string, email: string): string => {
  const source = name.trim() || email;
  const parts = source.split(/\s+/u).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

export const ProfilePanel = ({ user }: Props) => {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [hasImage, setHasImage] = useState(user.hasImage);
  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const [imagePending, setImagePending] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [profilePending, setProfilePending] = useState(false);

  const imageSrc = hasImage
    ? `/api/account/avatar?v=${imageVersion}`
    : undefined;

  let imageButtonLabel = "Upload";
  if (imagePending) {
    imageButtonLabel = "Uploading…";
  } else if (hasImage) {
    imageButtonLabel = "Change";
  }

  const profileDirty = name.trim() !== user.name && name.trim().length > 0;

  const handleImagePicked = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setImagePending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/account/avatar", { body, method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      setHasImage(true);
      setImageVersion(Date.now());
      toast.success("Photo updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setImagePending(false);
    }
  };

  const handleImageRemove = async () => {
    setImagePending(true);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Could not remove photo");
      }
      setHasImage(false);
      toast.success("Photo removed");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove photo"
      );
    } finally {
      setImagePending(false);
    }
  };

  const handleProfileSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!profileDirty) {
      return;
    }
    setProfilePending(true);
    const { error } = await authClient.updateUser({ name: name.trim() });
    setProfilePending(false);
    if (error) {
      toast.error(error.message ?? "Could not update profile");
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Avatar card */}
      <div className="border-border/60 bg-card rounded-xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">Profile photo</h2>
        <div className="flex items-center gap-5">
          <Avatar
            className="ring-border/60 size-16 rounded-xl ring-2 after:rounded-xl"
            size="lg"
          >
            {imageSrc ? (
              <AvatarImage
                alt={name || user.email}
                className="rounded-xl"
                src={imageSrc}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary rounded-xl text-lg font-semibold">
              {getInitials(name, user.email)}
            </AvatarFallback>
          </Avatar>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImagePicked}
            ref={imageInputRef}
            type="file"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm font-medium">{name || user.email}</p>
            <p className="text-muted-foreground mb-3 text-xs">{user.email}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={imagePending}
                onClick={() => imageInputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                {imageButtonLabel}
              </Button>
              {hasImage ? (
                <Button
                  disabled={imagePending}
                  onClick={handleImageRemove}
                  size="sm"
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Profile details card */}
      <div className="border-border/60 bg-card rounded-xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">Profile details</h2>
        <form className="flex flex-col gap-4" onSubmit={handleProfileSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              autoComplete="name"
              id="name"
              name="name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              disabled
              id="email"
              name="email"
              readOnly
              type="email"
              value={user.email}
            />
            <p className="text-muted-foreground text-xs">
              {user.emailVerified
                ? "Your email is verified."
                : "Email change isn't supported yet."}
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              disabled={!profileDirty || profilePending}
              size="sm"
              type="submit"
            >
              {profilePending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
