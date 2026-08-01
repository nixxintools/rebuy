import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";

export default function Loading() {
  return (
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={140} />
      <Skeleton variant="rounded" height={84} />
      <Skeleton variant="rounded" height={84} />
    </Stack>
  );
}
