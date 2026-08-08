import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Delete, behind a dialog that says what the endpoint actually removes.
 *
 * A dialog rather than the legacy's two-stage inline "Wirklich löschen? Ja /
 * Nein": that swap was invisible to a screen reader and dismissable only by
 * clicking elsewhere.
 */
export function DeleteMatchDialog({
  title,
  onConfirm,
  defaultOpen,
  className,
}: {
  /** The match, named in the trigger and in the question. */
  title: string
  onConfirm: () => void
  /** Stories and tests render the dialog open without driving the trigger. */
  defaultOpen?: boolean
  className?: string
}) {
  const { t } = useTranslation(['dashboard', 'common'])

  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('delete.action', { title })}
          className={cn('text-muted-foreground hover:text-destructive', className)}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.description', { title })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="text-sm text-muted-foreground">{t('delete.retained')}</p>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={onConfirm}
          >
            {t('delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
