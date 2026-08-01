"use client";
import Chip from "@mui/material/Chip";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import BlockIcon from "@mui/icons-material/Block";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { ChipProps } from "@mui/material/Chip";
import type { ReactElement } from "react";
import { STATUS, statusMeta } from "@/lib/status";

const ICONS: Record<string, ReactElement> = {
  [STATUS.ingested]: <LockOpenIcon />,
  [STATUS.authorizing]: <LockOpenIcon />,
  [STATUS.monitoring]: <VisibilityIcon />,
  [STATUS.dropDetected]: <TrendingDownIcon />,
  [STATUS.purchaseAuthorized]: <CreditCardIcon />,
  [STATUS.orderPlaced]: <Inventory2Icon />,
  [STATUS.returnStarted]: <LocalShippingIcon />,
  [STATUS.refundConfirmed]: <CheckCircleIcon />,
  [STATUS.chargeFailed]: <ErrorOutlineIcon />,
  [STATUS.authorizationExpired]: <WarningAmberIcon />,
  [STATUS.revocationPending]: <ErrorOutlineIcon />,
  [STATUS.revoked]: <BlockIcon />,
  [STATUS.expired]: <ScheduleIcon />,
  [STATUS.watchOnly]: <VisibilityIcon />,
};

const TONE_COLOR: Record<string, ChipProps["color"]> = {
  neutral: "default",
  active: "info",
  success: "success",
  warning: "warning",
  error: "error",
};

export default function StatusChip({
  status,
  size = "small",
}: {
  status: string;
  size?: "small" | "medium";
}) {
  const meta = statusMeta(status);
  return (
    <Chip
      label={meta.label}
      color={TONE_COLOR[meta.tone] ?? "default"}
      icon={ICONS[status] ?? <ScheduleIcon />}
      size={size}
      variant="outlined"
    />
  );
}
