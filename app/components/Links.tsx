"use client";
import Button, { type ButtonProps } from "@mui/material/Button";
import ListItemButton, { type ListItemButtonProps } from "@mui/material/ListItemButton";
import Link from "next/link";

/**
 * Server components can't pass a component reference into a client component,
 * so the Next.js Link wiring lives here on the client side.
 */
export function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}

export function LinkListItemButton({
  href,
  ...props
}: ListItemButtonProps & { href: string }) {
  return <ListItemButton component={Link} href={href} {...props} />;
}
