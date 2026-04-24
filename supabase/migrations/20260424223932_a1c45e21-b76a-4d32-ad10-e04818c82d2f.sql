CREATE POLICY "Users can delete own logs"
ON public.message_logs
FOR DELETE
USING (auth.uid() = user_id);