"use client";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createLocation, deleteLocation } from "../actions/infrastructure";
import { useAction } from "../components/use-action";

export const CreateLocationForm = () => {
  const { pending, run } = useAction();
  const [short, setShort] = useState("");
  const [long, setLong] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await run(
          () => createLocation({ long, short }),
          "Location created"
        );
        if (result?.ok) {
          setShort("");
          setLong("");
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loc-short">Code</Label>
        <Input
          id="loc-short"
          placeholder="uk-lon"
          value={short}
          onChange={(e) => setShort(e.target.value)}
        />
      </div>
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="loc-long">Description</Label>
        <Input
          id="loc-long"
          placeholder="London, United Kingdom"
          value={long}
          onChange={(e) => setLong(e.target.value)}
        />
      </div>
      <Button disabled={pending || short.length < 2} type="submit">
        Create
      </Button>
    </form>
  );
};

export const DeleteLocationButton = ({
  id,
  disabled,
}: {
  id: string;
  disabled: boolean;
}) => {
  const { pending, run } = useAction();
  return (
    <Button
      aria-label="Delete location"
      disabled={disabled || pending}
      size="icon"
      title={disabled ? "Location has nodes" : "Delete"}
      variant="ghost"
      onClick={() => void run(() => deleteLocation(id), "Location deleted")}
    >
      <Trash2Icon className="size-4" />
    </Button>
  );
};
