import { WalletConnect } from './walletconnect'

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180"><path d="M94.27 151.629c-.861-.526-1.51-1.37-1.83-2.386-.197-.62-.18-.627 1.082-.437.705.105 1.6.356 1.988.557.696.36 1.815 1.876 1.815 2.459 0 .486-2.166.348-3.054-.193m23.953-.263c-.788-.419-2.095-2.123-2.108-2.75-.01-.433 2.467-.182 3.403.345.955.536 2.148 1.97 2.148 2.582 0 .503-2.397.38-3.443-.177m-9.024-1.165c-1.567-1.193-2.38-2.74-2.55-4.849-.075-.933-.054-1.697.045-1.697.866 0 2.714 1.67 3.439 3.107.398.789.657 3.888.351 4.195-.07.07-.648-.27-1.285-.756m-8.906-1.354c-.63-.684-1.21-1.648-1.387-2.305-.318-1.18-.136-3.416.278-3.416.555 0 2.108 1.697 2.505 2.737.472 1.237.457 3.905-.023 4.063-.16.053-.777-.433-1.373-1.08m-6.805-1.775c-2.764-.612-5.223-1.425-5.357-1.772-.08-.21.169-1.027.555-1.814s.701-1.469.701-1.515c0-.047-.803.067-1.786.253-.982.185-1.857.256-1.944.157-.088-.1-.365-.715-.618-1.367-.252-.652-.858-1.729-1.345-2.393-1.293-1.76-5.285-5.526-7.272-6.858-3.826-2.564-4.96-3.855-4.667-5.316.08-.402.692-1.574 1.359-2.606 1.65-2.551 2.51-4.472 2.512-5.62.002-.571-.364-1.69-.901-2.758l-.905-1.796.706-.532c1.936-1.46 4.649-4.916 4.205-5.36-.06-.06-.846.72-1.745 1.732-3.553 3.997-7.814 6.463-16.014 9.27-5.324 1.823-5.853 2.06-7.183 3.228-1.555 1.365-1.962 2.502-2.531 7.063-.284 2.275-.706 4.79-.937 5.591-.231.8-.403 2.17-.382 3.043.032 1.346-.157 2.06-1.248 4.698-1.498 3.622-1.068 3.708-4.138-.827l-2.036-3.008.747-.784c.411-.43 1.075-.978 1.475-1.216.955-.568.919-.922-.236-2.331-.53-.647-.917-1.209-.86-1.25s.43-.277.83-.526c1.788-1.12 2.7-4.727 2.987-11.822.214-5.274.595-6.46 2.195-6.83 6.634-1.535 7.58-1.98 8.618-4.066.926-1.858.9-3.701-.121-8.475-.87-4.072-1.047-7.21-.516-9.223.606-2.303 3.759-7.433 5.667-9.221.376-.353.684-.729.684-.835 0-.254-3.325-2.697-4.448-3.268-.482-.245-1.455-.45-2.163-.456-3.892-.03-6.628 1.877-8.722 6.08-.603 1.212-1.582 2.73-2.176 3.374-2.733 2.965-8.602 4.09-12.666 2.43l-.913-.374 1.323-.05c1.422-.054 3.498-.94 3.944-1.683.414-.69.076-.79-1.06-.314-1.443.605-4.075.597-5.039-.015-1.259-.8-2.23-1.81-2.795-2.908l-.535-1.042 1.243 1.095c1.51 1.328 2.691 1.752 4.425 1.585 1.506-.145 2.523-.851 1.65-1.147-3.195-1.08-5.834-3.078-7.07-5.35-.809-1.485-1.513-3.982-1.504-5.334l.006-.936.42.854c.232.47.941 1.333 1.576 1.918l1.155 1.064 2.189-.012 2.188-.011-1.012-.535c-.975-.514-3.353-2.766-3.353-3.175 0-.11.506.079 1.124.418 1.282.703 3.888 1.32 4.21.996.12-.118-.204-.612-.718-1.097-.513-.484-1.17-1.344-1.46-1.911l-.525-1.03 1.174.895c2.02 1.542 3.883 1.506 6.342-.123.69-.457 1.218-.863 1.175-.903s-.989.227-2.103.594c-1.87.618-2.11.64-3.151.305-1.284-.415-2.023-1.273-2.25-2.613l-.158-.926.486.595c1.07 1.31 2.652 1.255 6.363-.224 1.132-.451 2.892-1.036 3.91-1.3 2.732-.706 1.561-.926-2.298-.43-1.778.228-3.27.376-3.318.329-.047-.047.662-.415 1.575-.818 2.002-.883 4.78-1.152 6.858-.663 1.817.427 2.555.81 4.032 2.087 1.151.997 3.654 2.156 4.605 2.133.595-.015-2.96-3.395-4.552-4.328-1.639-.96-4.11-1.542-6.107-1.438-.92.049-1.627.016-1.571-.073.242-.388 3.44-.825 5.203-.71 4.048.265 6.96 2.546 10.902 8.537 2.553 3.883 4.234 5.67 6.137 6.524l1.092.49 2.215-1.027c4.747-2.2 8.797-2.518 16.097-1.26 2.25.387 4.717.704 5.482.704h1.39l.074 3.203.074 3.203.894-1.113c.88-1.096.894-1.152.846-3.516l-.049-2.402-1.61-1.721c-4.14-4.425-4.335-6.536-1.135-12.213 2.744-4.87 2.704-4.41.813-9.32-.883-2.292-1.696-4.167-1.807-4.167-.339 0-.205 4 .196 5.821.716 3.256.435 4.822-1.006 5.603-.371.2-2.144.33-4.904.36-3.6.036-4.348-.022-4.473-.348-.087-.227.102-.582.451-.845.53-.4.563-.53.274-1.09-.18-.35-.692-1.022-1.137-1.493s-.734-.933-.64-1.026c.093-.094 1.072-.036 2.175.128 3.023.45 3.76.398 4.211-.297.4-.615 2.887-9.725 2.704-9.907-.196-.196-1.55 1.62-2.759 3.7-1.782 3.068-3.14 3.895-6.379 3.889-2.485-.005-5.43-1.098-8.658-3.213-1.439-.943-3.02-1.855-3.514-2.027-1.524-.531-3.75-.392-5.163.324l-1.26.638.567-.603c.892-.95 3.048-2.004 4.432-2.167 1.94-.23 3.3.283 5.786 2.18 2.39 1.823 3.163 2.225 4.28 2.225.6 0 .497-.12-.745-.872-.792-.48-2.416-1.598-3.609-2.486-2.658-1.978-4.119-2.58-5.831-2.4l-1.26.132.926-.39c.667-.281 1.609-.36 3.373-.284 1.346.059 2.448.077 2.448.04 0-.278-2.537-1.455-3.71-1.722-.89-.202-1.231-.365-.884-.421.312-.051 1.86.225 3.44.614 2.564.63 3.167.687 5.602.525 5.536-.369 7.032-1.144 9.218-4.774l1.433-2.382-1.224 1.323c-.673.728-1.779 1.928-2.457 2.666-.677.739-1.53 1.417-1.893 1.508l-.662.165.61-.503c.334-.277 1.088-1.491 1.675-2.698 1.772-3.648 3.228-4.779 6.772-5.257 3.522-.476 4.797-.791 5.421-1.342.332-.293.429-.44.215-.329-.213.112-1.94.277-3.836.367-2.955.14-3.666.263-4.97.86-1.632.749-4.092 2.893-4.996 4.356-.764 1.236-.923.905-.224-.465 1.387-2.718 4.685-4.945 8.366-5.651l1.815-.349-1.058-.235c-.582-.13-1.952-.224-3.043-.209l-1.984.027 1.72-.82c1.427-.682 2.04-.822 3.611-.822 1.607 0 1.86-.06 1.679-.4-.539-1.005-1.377-1.452-2.69-1.432-.769.011-1.156-.067-.937-.19.534-.298 2.168-.34 4.169-.104 1.648.194 1.82.159 3.59-.733 1.023-.515 2.472-1.047 3.22-1.183 1.388-.253 3.607-.04 4.472.429.942.51 1.958 1.825 2.095 2.712.116.746 0 1.052-.671 1.777-.752.813-.811 1.018-.811 2.82 0 1.706-.105 2.127-.85 3.424-.467.814-.973 1.476-1.124 1.473s-.797-.242-1.435-.532c-1.277-.579-1.714-.435-1.988.655-.115.46.045.84.605 1.44.42.448 1.621 2.237 2.671 3.975 1.883 3.116 1.905 3.175 1.585 4.146-.258.78-.258 1.56 0 3.73.179 1.51.253 3.031.166 3.38-.128.509.033.795.805 1.432 1.367 1.126 5.02 2.947 5.914 2.947 1.268 0 1.588.247 1.588 1.227 0 1.057-.642 2.742-1.045 2.742-.153 0-.278-.298-.278-.662 0-.558-.123-.661-.793-.661-.436 0-2.162-.467-3.836-1.036l-3.044-1.036v1.788c0 .984-.077 3.057-.172 4.608l-.173 2.82h3.015l-.133.86c-.073.472-.206 2.11-.295 3.637-.373 6.42-.634 7.203-4.207 12.65-4.119 6.278-4.635 7.984-3.493 11.548.37 1.158.647 2.133.613 2.167-.246.246-2.569-1.19-3.783-2.34-2.616-2.473-2.922-3.975-1.146-5.619.954-.882 1.054-1.087.892-1.828-.417-1.91-.553-1.976-1-.482-.232.777-.693 1.849-1.024 2.382-.526.846-.603 1.318-.603 3.705v2.736l3.175 1.022c1.746.562 3.446 1.028 3.777 1.034.583.012.59-.012.194-.776-.224-.434-.479-1.307-.566-1.939-.208-1.523.53-3.065 3.905-8.159 4.537-6.845 5.478-9.25 5.681-14.513.07-1.82.19-3.93.267-4.692.137-1.353.17-1.398 1.379-1.933 2.27-1.004 4.245-3.717 6.253-8.589.526-1.274.459-1.204-1.891 1.985-1.019 1.382-2.13 2.751-2.47 3.042-.604.516-.603.506.048-.397.938-1.299 1.216-2.144 1.685-5.107.663-4.193 1.699-6.255 4.604-9.16 3.639-3.638 9.47-6.348 13.7-6.365.635-.003 1.201-.155 1.322-.356.117-.192 1.105-.92 2.196-1.615 1.092-.696 2.252-1.511 2.579-1.812.327-.3.66-.48.74-.4.081.081-.038.942-.263 1.914s-.41 1.88-.41 2.016c0 .37 1.393.3 1.992-.102.287-.192 1.296-.62 2.241-.953s1.998-.78 2.338-.994c.34-.215.665-.345.722-.288.302.302-1.982 3.526-2.927 4.132l-1.152.74c-.277.179 1.202 3.732 1.975 4.745.674.882.862 1.347.742 1.825-.089.354.045 1.273.296 2.044.645 1.98 2.913 6.751 3.698 7.779.808 1.06.82 1.416.075 2.363-.32.408-.648 1.225-.728 1.816-.118.879-.279 1.12-.89 1.335-1.457.512-2.298-.449-2.94-3.358-.113-.512-.325-.728-.715-.728-.634 0-.619.099.398 2.514.368.873.572 1.685.453 1.804-.12.119-.679.178-1.244.132-1.006-.082-1.03-.108-1.165-1.29-.11-.958-.407-1.515-1.444-2.716-1.28-1.483-1.523-1.617-3.974-2.186-.436-.102-1.235-.406-1.776-.677l-.981-.491-.311 1.124c-.462 1.668-.381 7.592.14 10.35.244 1.29.926 3.552 1.516 5.027 1.864 4.655 1.933 4.98 1.924 9.031-.006 2.853-.112 3.972-.461 4.87-.25.641-.415 1.204-.367 1.252.047.047 2.935.203 6.419.347 4.2.174 6.786.397 7.679.664 1.433.429 2.955 1.341 3.328 1.995.125.219 1.292 3.718 2.594 7.777 2.56 7.978 2.515 7.613 1.142 9.263-.582.7-.623.918-.458 2.455l.18 1.686-1.685 1.59c-2.476 2.335-2.487 2.338-2.833.702l-.825-3.894c-.497-2.344-.503-2.535-.09-2.844.245-.182.75-.332 1.121-.335 1.259-.007 1.444-.36.672-1.277l-.7-.833.461-1.209c.403-1.054.421-1.428.146-2.924-.856-4.647-3.463-7.755-6.516-7.769-1.198-.006-5.626.726-6.143 1.015-.419.235 1.36 2.035 4.026 4.073 1.954 1.494 2.487 2.265 2.708 3.918.115.858-.031 1.278-.963 2.753-1.122 1.776-2.596 4.941-4.015 8.62-.437 1.133-1.048 2.383-1.358 2.777-.546.695-.623.712-2.434.544-1.51-.14-2.034-.085-2.726.287-.933.503-1.032.488-5.234-.754l-1.852-.547 1.058-.93c2.452-2.155 4.96-4.035 5.375-4.028.245.004.743.417 1.107.919.364.5.74.914.835.918.336.014 2.673-2.777 3.423-4.09.928-1.622 1.429-3.721 1.19-4.992-.414-2.208-2.105-3.2-8.836-5.183-4.604-1.356-5.44-1.637-6.837-2.3-.81-.384-.92-.36-3.047.664-2.593 1.248-5.507 2.251-8.665 2.983-3.304.766-9.686.95-12.988.376-3.227-.562-7.639-2.035-9.626-3.214-.856-.508-1.618-.862-1.693-.787-.15.15 1.12 2.079 1.665 2.53.271.226.239.732-.166 2.586-1.245 5.713-2.66 8.612-7.189 14.73-2.852 3.852-3.402 5.685-2.327 7.762.66 1.274 9.278 9.763 11.016 10.85.797.498 1.576 1.26 1.929 1.889.496.883 2.158 5.275 2.158 5.704 0 .2-1.577.111-2.779-.154m46.76-1.68c-2.98-1.107-5.348-3.111-7.054-5.97-1.025-1.72-2.16-4.428-1.946-4.643.229-.229 3.039.644 4.916 1.527 3.417 1.608 6.275 5.198 6.594 8.283.178 1.723.063 1.76-2.51.803m-70.399.107c-2.923-.4-6.887-2.043-7.56-3.132-.23-.371 1.693-1.772 3.683-2.683 4.119-1.887 9.22-1.779 13.075.277 1.637.873 4.347 2.943 4.307 3.29-.014.122-.895.499-1.957.837-4.06 1.29-8.482 1.831-11.548 1.411m51.264-1.55c-1.687-.66-3.315-1.831-4.87-3.503l-1.323-1.421 2.116-.183c3.467-.298 6.424.354 8.757 1.932 1.096.742 2.753 2.456 2.753 2.848 0 .859-5.46 1.099-7.433.326m38.521-1.26c-3.84-.798-6.966-2.331-9.705-4.761-2.156-1.913-3.179-2.512-5.08-2.978-1.478-.362-3.339-1.249-3.339-1.591 0-.318 2.824-.81 5.689-.991 7.046-.446 13.549 2.741 16.133 7.908.513 1.024.932 2.025.932 2.224 0 .277-.479.354-2.05.33-1.128-.016-2.289-.08-2.58-.14m-61.217-2.076c-1.35-.421-2.52-1.449-3.238-2.845l-.51-.992h1.178c1.479 0 2.46.365 3.42 1.273.65.615 1.762 2.392 1.762 2.817 0 .255-1.426.117-2.612-.253m5.45-1.504c-1.583-1.153-2.396-3.509-1.878-5.442.192-.715.563-.742 1.334-.098 1.18.986 1.673 2.177 1.674 4.051 0 .974-.09 1.826-.2 1.895-.112.068-.53-.114-.93-.406m-26.254-1.075a150 150 0 0 0-3.968-1.97l-2.382-1.138 1.21-.001c2.527-.002 4.928 1.203 6.339 3.185.306.43.52.777.473.77-.046-.007-.799-.388-1.672-.845zm-14.354-3.608c-.764-.264-1.631-.699-1.927-.966-.59-.534-1.695-2.22-1.542-2.352.053-.045.573-.192 1.155-.325 1.324-.303 1.45-.925.662-3.265-.306-.908-.503-1.705-.438-1.77.066-.066.637.018 1.27.187.95.253 1.683.849 4.194 3.411 2.483 2.534 3.286 3.19 4.366 3.566.727.253 1.62.587 1.984.742l.662.28-.662.199c-.779.234-6.102.794-7.42.782-.503-.005-1.54-.225-2.304-.489m104.313-.83c-1.528-.484-4.719-2.704-4.75-3.303-.006-.145.88-.42 1.972-.61 2.368-.414 4.676-.11 6.582.864 1.41.721 3.082 2.35 2.83 2.756-.55.891-4.237 1.054-6.634.294m-56.58-.117c-2.06-.734-3.35-2.65-3.345-4.961.006-2.304.15-2.574 1.279-2.397 1.516.239 3.013.83 3.677 1.455l.609.572 1.523-1.507c.838-.829 1.593-1.507 1.679-1.507.085 0 .362.735.614 1.633.94 3.35-.383 5.974-3.431 6.806-1.302.356-1.35.354-2.605-.094m-75.315-.698c-6.533-.942-11.018-2.967-14.552-6.571-1.972-2.01-3.175-3.81-2.8-4.186.109-.109 1.32-.239 2.693-.29 5.235-.192 9.266 1.449 13.22 5.381 2.097 2.085 5.101 5.853 4.838 6.068-.05.041-1.58-.14-3.4-.402m97.327-1.25c4.267-5.096 8.959-7.442 13.334-6.666.982.174 1.84.405 1.906.513.198.32-1.54 2.713-2.834 3.904-2.314 2.13-5.42 3.148-10.492 3.438l-3.055.175zm17.502-.559c0-.646 1.702-5.318 2.447-6.715 1.472-2.762 4.84-5.965 5.538-5.267.161.161.234 1.18.176 2.481-.114 2.603-.705 4.023-2.51 6.03-1.524 1.695-5.651 4.23-5.651 3.471m8.04-1.157c3.728-2.356 7.725-5.133 8.864-6.158 1.353-1.218 1.403-1.24.984-.43-1.093 2.113-4.85 5.104-7.93 6.31-1.734.68-2.798.834-1.919.278m2.457-4.828c-.243-.511-.443-1.383-.443-1.937 0-1.018.973-3.223 1.5-3.399.368-.123 1.146 1.814 1.146 2.853 0 .855-.78 2.6-1.39 3.105-.298.247-.456.127-.813-.622m11.343.373c-1.157-.135-2.15-.292-2.206-.348-.16-.16 1.966-2.017 3.71-3.24 2.387-1.673 4.54-2.317 7.745-2.316 2.182 0 2.874.104 3.949.596l1.303.595-.907.936c-2.935 3.03-7.986 4.433-13.594 3.777m-135.543-5.98c-3.17-5.953-3.802-11.809-1.769-16.407.766-1.73 2.408-4.033 2.878-4.033.185 0 .7.685 1.142 1.522 2.02 3.82 2.643 8.569 1.708 13.03-.515 2.454-2.383 7.938-2.705 7.938-.089 0-.653-.923-1.254-2.05m131.543-.026c-2.11-1.55-3.023-3.093-3.023-5.108 0-1.215.77-3.056 1.587-3.796.494-.447.574-.438 1.965.243 1.713.838 2.676 1.892 3.072 3.363.464 1.725-.257 3.872-1.791 5.328l-.771.733zm-142.341-2.392c-.955-.434-3.028-2.462-3.028-2.963 0-.106.589-.273 1.309-.372 2.032-.28 3.923.381 5.269 1.84.602.654 1.095 1.295 1.095 1.426 0 .289-1.308.57-2.613.562-.527-.003-1.442-.225-2.032-.493m134.927-3.139c1.218-3.954 1.471-13.59.477-18.203a57 57 0 0 0-1.472-5.291c-1.025-3-1.187-3.508-1.031-3.229.06.11.227.199.369.199s.185-.12.095-.265-.099-.265-.019-.265c.285 0 2.284 4.27 2.94 6.28.942 2.884 1.488 6.584 1.481 10.037-.008 4.205-.63 7.156-2.126 10.088-.577 1.13-.974 1.491-.714.65m15.622-.53c.096-.4.694-1.798 1.33-3.108 1.78-3.673 4.396-6.043 7.61-6.899 2.261-.602 2.412-.555 2.244.699-.39 2.903-3.348 6.413-6.971 8.27-.455.233-1.63.726-2.608 1.094l-1.78.67zm-150.592-3.621c-5.551-2.683-8.865-5.295-11.436-9.013-2.092-3.028-3.72-7.066-3.72-9.231 0-.636.089-.69 1.135-.69 2.913 0 6.796 1.74 9.585 4.296 3.283 3.008 5.033 6.073 6.587 11.534 1.15 4.043 1.263 4.544 1.02 4.54-.111 0-1.539-.647-3.17-1.436m145.075.485c-.092-.241-.309-1.552-.48-2.914-.562-4.443.43-8.183 2.772-10.456.58-.562 1.164-1.022 1.3-1.022.405 0 1.01 1.75 1.186 3.43.324 3.1-.9 6.63-3.421 9.872-.926 1.19-1.226 1.431-1.357 1.09m-6.353-7.675c.34-1.413.908-2.21 1.957-2.745 1.55-.792 1.96-.718 1.754.314-.326 1.628-1.397 2.695-3.034 3.022-.84.168-.856.154-.677-.591m18.432-2.084c-.473-.206-.857-.469-.854-.585.01-.368 1.945-1.592 2.816-1.781.461-.1 1.34-.047 1.952.118l1.114.3-.882.909c-.764.789-2.17 1.45-3.022 1.422-.145-.005-.651-.178-1.124-.383m-4.19-2.014c.437-5.243 1.85-8.992 4.434-11.754 1.589-1.698 4.011-3.172 5.51-3.353.608-.073.669.016.745 1.087.125 1.742-.655 4.812-1.81 7.117-1.233 2.466-3.244 4.75-6.16 7-3.185 2.457-2.932 2.466-2.719-.097M164.535 96.2c.011-.601.996-2.432 1.613-2.997.74-.68 1.86-1.142 2.764-1.142.74 0 .783.213.287 1.402-.328.784-2.05 2.558-2.496 2.573-.105.004-.636.11-1.182.237-.703.163-.99.142-.986-.073M39.38 92.511l-1.19-.287 1.894-.184c2.429-.237 4.211-.836 5.755-1.933 1.705-1.212 2.43-2.3 3.187-4.777.358-1.173 1.027-2.644 1.487-3.27.855-1.16 1.328-1.354.772-.315-.17.317-.42 1.753-.555 3.191s-.371 2.944-.524 3.347c-1.29 3.39-6.255 5.33-10.826 4.228m132.353-3.022c-1.37-3.004-1.722-4.62-1.596-7.322.12-2.584.663-4.209 1.984-5.941l.698-.915.593.689c1.538 1.787 2.37 6.366 1.72 9.457-.375 1.79-1.903 5.61-2.293 5.734-.158.05-.656-.715-1.106-1.702m6.655.323c.094-.582.245-3.618.336-6.747.16-5.514-.097-11.175-.726-16.007-.66-5.078-2.584-11.438-4.788-15.834-.572-1.142-.914-1.998-.76-1.903.154.096.28.02.28-.17 0-.608 1.905 2.465 3.056 4.93 3.19 6.83 5.492 18.482 5.039 25.5-.219 3.379-.79 6.78-1.52 9.04-.672 2.084-1.164 2.722-.917 1.191m-5.129-39.936c0-.065-.119-.19-.264-.28s-.265-.038-.265.116.12.28.265.28.264-.052.264-.116M21.39 87.46c-6.885-6.262-9.634-10.983-10.312-17.71-.218-2.153.098-6.211.514-6.628.377-.377 2.86.757 4.714 2.153 4.287 3.228 7.128 8.67 7.976 15.276.349 2.717.746 9.923.547 9.92-.073-.001-1.62-1.356-3.44-3.01m141.818 1.495c.002-1.223.51-2.654 1.254-3.539.681-.81 2.635-1.902 2.999-1.677.248.154-.193 2.347-.65 3.224-.523 1.007-1.444 1.82-2.616 2.31l-.989.413zm19.715-9.65c.101-.48.414-1.25.694-1.712.53-.872 2.361-1.937 3.331-1.937.515 0 .537.075.29.992-.432 1.599-1.891 2.901-3.749 3.347-.733.176-.746.16-.566-.69m-1.078-4.864c-.434-3.474.426-7.949 2.004-10.427.992-1.557 3.308-3.704 3.996-3.704.79 0 1.023 5.098.34 7.427-.775 2.639-3.22 6.102-5.41 7.661l-.744.53zM27.106 70.74c-.83-2.163.852-9.285 3.442-14.577 3.414-6.977 9.876-14.173 15.518-17.28 1.338-.736 1.306-.696-.732.921-3.554 2.82-6.93 6.51-9.617 10.514-2.78 4.142-4.184 7.582-5.825 14.274-.593 2.419-1.273 4.885-1.512 5.482-.446 1.116-.991 1.401-1.274.666m148.415-4.429c-3.31-1.775-5.714-4.87-6.05-7.787-.123-1.073-.097-1.124.573-1.122 1.742.006 4.537 2.38 5.833 4.954.468.928 1.437 4.572 1.263 4.746-.028.028-.757-.328-1.62-.79M24.465 63.817c-1.392-2.767-2.046-5.175-2.208-8.138-.16-2.924.292-6.48.823-6.48.632 0 2.73 1.536 3.654 2.676 1.65 2.036 2.173 3.325 2.185 5.393.01 1.729-.094 2.069-1.554 5.094-.86 1.782-1.663 3.24-1.783 3.24s-.623-.803-1.117-1.785m155.049-4.47c-.602-3.045-.356-5.571.757-7.767.795-1.57 2.708-3.351 3.137-2.921.187.187.302 1.33.302 3 0 2.617-.03 2.756-1.001 4.573-.551 1.03-1.462 2.322-2.024 2.871l-1.022.998zm-68.432-2.831c0-.451.748-1.115 1.521-1.35.762-.233.743.064-.061.978-.678.77-1.46.969-1.46.372M33.59 54.752c1.046-1.877 3.42-4.082 5.433-5.045 1.457-.699 2.23-.892 3.93-.982 2.15-.115 3.863.18 4.728.812.444.324.393.442-.74 1.701-1.47 1.635-3.438 2.97-5.575 3.778-1.242.47-2.33.63-4.998.735l-3.41.135zm76.965.194c0-.802 1.282-2.19 2.17-2.35.969-.176 1.534.041 1.534.587 0 .382-.305.583-1.245.82-.685.172-1.518.608-1.852.968l-.607.655zm57.018-.605c-.437-.225-.965-.578-1.173-.783-.327-.323-.22-.446.794-.905 1.314-.597 2.774-.659 4.347-.184 1.386.417 1.347.95-.122 1.69-1.377.695-2.73.76-3.846.182m-58.306-1.16c.174-.5.815-1.406 1.424-2.015.918-.918 1.368-1.152 2.637-1.37 1.42-.246 2.024-.224 3.048.107.8.26-.765 1.148-2.022 1.148-1.584 0-2.915.6-4.27 1.928l-1.133 1.109zm65.577-2.87c-.75-1.497-.906-2.129-1.001-4.048-.094-1.886-.02-2.485.431-3.506.3-.677.655-1.231.79-1.231.33 0 1.475 1.777 1.856 2.883.497 1.442.383 4.31-.236 5.965-.3.803-.638 1.517-.75 1.586-.11.069-.602-.673-1.09-1.649m-65.359.239c.662-1.25 2.453-2.918 3.604-3.357 1.384-.53 4.318-.42 5.512.206l.757.397-.576.403c-.45.315-1.084.374-2.904.27-2.854-.163-3.938.155-5.54 1.625-.876.802-1.1.922-.853.456m-79.602-1.036c-1.895-1.894-2.474-3.183-2.62-5.824-.066-1.211-.008-2.314.128-2.45.332-.332 2.019.945 2.831 2.145.348.513.825 1.5 1.06 2.192.47 1.384.581 4.818.164 5.076-.144.089-.848-.423-1.563-1.139m78.698-.58c.528-1.848 2.227-3.934 3.94-4.841 1.648-.872 4.113-.74 7.331.392l2.55.897-.936.614c-.919.602-.967.606-2.55.2-2.732-.698-3.209-.739-5.014-.424-2.025.352-3.826 1.419-4.84 2.865-.543.777-.635.833-.481.297m54.957-.028c-.619-.306-1.125-.665-1.125-.797 0-.133.387-.477.86-.765 1.455-.887 4.475-.65 6.244.49l.621.401-1.15.602c-1.547.81-3.894.84-5.45.07m-113.51-5.029c-.621-.307-1.376-.872-1.677-1.255l-.548-.696.883-.372c2.07-.872 5.296-.261 6.675 1.263.498.55.494.556-.662 1.08-1.52.69-3.253.682-4.672-.02m69.126-.293c-2.905-1.128-5.647-1.179-7.871-.147-.837.388-1.522.665-1.522.615 0-.292 2.738-1.751 3.95-2.106 1.796-.525 4.726-.535 6.634-.023 1.759.472 3.564.489 4.61.043.696-.298.59-.32-1.07-.226-1.83.103-1.852.096-3.683-1.16-1.013-.694-2.318-1.413-2.9-1.596l-1.058-.333.988-.018c.544-.01 2.135.28 3.535.644 2.6.675 4.605.856 4.605.415 0-.347-1.479-1.36-2.616-1.791-.935-.355-.915-.361.9-.261 2.1.115 3.862.79 4.957 1.899.72.729.727.73.727.13 0-.934-1.81-2.484-3.47-2.973-1.732-.51-.9-.598.957-.102 2.68.716 5.39 2.515 6.21 4.124.295.578.537 1.15.537 1.273 0 .122-1.102.361-2.448.532s-3.511.671-4.812 1.112c-3.03 1.027-4.41 1.017-7.16-.05m-83.06-2.246c-.331-4.672.95-8.655 3.622-11.257l1.343-1.308.418.754c.31.56.419 1.506.419 3.664 0 2.803-.036 2.984-.958 4.895-.887 1.84-3.687 5.524-4.365 5.745-.197.064-.358-.772-.48-2.493m125.87-.33c-.464-.283-1.05-.829-1.301-1.212-.556-.848-.22-1.17 1.221-1.176 1.652-.007 4.104 1.78 3.588 2.615-.3.486-2.579.34-3.507-.227m-104.922-.902c-1.831-.683-4.166-2.965-3.74-3.655.203-.328 3.603-.26 4.628.093.494.17 1.341.6 1.882.955 1.055.692 2.477 2.374 2.223 2.628-.352.353-4.033.337-4.993-.021m.993-5.296c-.727-.191-2.034-.56-2.902-.82l-1.58-.473.898-.75c2.53-2.112 6.92-3.595 9.62-3.25 1.876.239 3.85 1.003 4.937 1.91l.907.758-1.14.825c-1.943 1.409-3.805 1.977-6.771 2.068-1.607.05-3.165-.056-3.969-.268" style="fill:teal;stroke-width:.264583"></path></svg>
`)}`

export class BiatecWallet extends WalletConnect {
  static defaultMetadata = {
    name: 'BiatecWallet',
    icon: ICON
  }
}