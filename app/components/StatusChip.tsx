"use client";
import Chip from "@mui/material/Chip";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import BlockIcon from "@mui/icons-material/Block";
import ScheduleIcon from "@mui/icons-material/Schedule";
import type { ChipProps } from "@mui/material/Chip";
import type { ReactElement } from "react";

const MAP: Record<string, { label: string; color: ChipProps["color"]; icon: ReactElement }> = {
  ingested: { label: "Needs your OK", color: "warning", icon: <LockOpenIcon /> },
  authorizing: { label: "Approval pending", color: "warning", icon: <LockOpenIcon /> },
  monitoring: { label: "Watching price", color: "info", icon: <VisibilityIcon /> },
  drop_detected: { label: "Price dropped", color: "secondary", icon: <TrendingDownIcon /> },
  return_ready: { label: "Rebought", color: "success", icon: <CheckCircleIcon /> },
  revoked: { label: "Stopped", color: "default", icon: <BlockIcon /> },
  expired: { label: "Window closed", color: "default", icon: <ScheduleIcon /> },
};

export default function StatusChip({ status, size = "small" }: { status: string; size?: "small" | "medium" }) {
  const s = MAP[status] ?? { label: status, color: "default" as const, icon: <ScheduleIcon /> };
  return <Chip label={s.label} color={s.color} icon={s.icon} size={size} variant="outlined" />;
}
