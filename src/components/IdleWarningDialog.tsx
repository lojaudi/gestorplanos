import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  secondsLeft: number;
  onStayActive: () => void;
}

export function IdleWarningDialog({ open, secondsLeft, onStayActive }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sessão inativa</AlertDialogTitle>
          <AlertDialogDescription>
            Você será desconectado em <strong>{secondsLeft}</strong> segundos por inatividade.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={onStayActive}>Continuar conectado</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
