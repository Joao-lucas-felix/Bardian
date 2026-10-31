# Recebe a identidade confirmada pelo Google e aplica as regras da conta local.
class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  # Entra, cria ou vincula uma conta após o retorno OAuth; nunca vincula por e-mail.
  # A entrada é o hash `omniauth.auth` validado pelo middleware. O resultado é um
  # redirecionamento com sessão autenticada ou aviso de recusa.
  def google_oauth2
    linking = request.env.dig("omniauth.params", "link") == "1"
    if linking && !current_user
      return redirect_to new_user_session_path, alert: "Entre com sua senha antes de vincular o Google."
    end
    if current_user && !linking
      return redirect_to compositions_path, alert: "Inicie a vinculação pelo menu da sua conta."
    end

    result = User.authenticate_with_google(request.env["omniauth.auth"] || {}, current_user: current_user)
    if result.error
      redirect_to(current_user ? compositions_path : new_user_session_path,
        alert: error_message(result.error))
    elsif current_user
      redirect_to compositions_path, notice: "Conta Google vinculada."
    else
      sign_in_and_redirect result.user, event: :authentication
    end
  end

  # Trata cancelamentos e falhas de autorização sem expor detalhes do provedor.
  def failure
    redirect_to new_user_session_path, alert: "Não foi possível entrar com Google. Tente novamente."
  end

  private

  # Traduz o motivo do domínio em orientação curta ao usuário.
  def error_message(error)
    case error
    when :email_taken then "Entre com sua senha e vincule o Google na sua conta."
    when :identity_taken then "Esta conta Google já está vinculada a outra conta."
    when :already_linked then "Esta conta já está vinculada a outro Google."
    when :unverified_email then "Confirme seu e-mail no Google antes de entrar."
    else "Não foi possível confirmar sua identidade Google."
    end
  end
end
